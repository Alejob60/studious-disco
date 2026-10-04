<#
.SYNOPSIS
  Builds the TimesFM image and deploys the optional challenger pipeline.

.DESCRIPTION
  WARNING: this creates an App Runner service, which bills for the time it exists
  rather than the time it is used. Roughly 60-90 USD per month at 1 vCPU / 4 GB
  with MinSize 1.

  The dashboard is fully functional without this. The forecast Lambda serves the
  Holt-Winters champion whenever no fresh forecast.json exists, so nothing here
  is required for the hackathon demo.

  Stages:
    1. Build the Docker image locally
    2. Create the ECR repository and push
    3. Bundle and upload the batch Lambda
    4. Apply the CloudFormation stack
    5. Trigger one refresh so you do not wait for the schedule

.EXAMPLE
  ./infra/deploy-timesfm.ps1 -ImageTag 1.0.0

.EXAMPLE
  ./infra/deploy-timesfm.ps1 -StackName atelier-predict-timesfm -ScheduleExpression 'cron(30 9 * * ? *)'
#>
[CmdletBinding()]
param(
  [string]$Profile = 'default',
  [string]$Region = 'us-east-1',
  [string]$StackName = 'atelier-predict-timesfm',
  [string]$ImageTag = '1.0.0',
  [string]$ImageName = 'atelier-predict-timesfm',
  [string]$ArtifactBucket = 'atelier-predict-artifacts-409514059726',
  [string]$ForecastBucketName = '',
  [string]$ScheduleExpression = 'cron(30 4 * * ? *)',
  [string]$CpuSize = '2 vCPU',
  [string]$MemorySize = '4 GB',
  [switch]$PushOnly,
  [switch]$SkipTrigger
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$stagingDir = Join-Path $repoRoot 'infra\.staging-timesfm'
$awsArgs = @('--region', $Region, '--profile', $Profile)

Write-Host "`n==> 1/5 Verifying AWS credentials" -ForegroundColor Cyan
aws sts get-caller-identity @awsArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Not authenticated for profile '$Profile'." }
$account = (aws sts get-caller-identity @awsArgs --query Account --output text).Trim()
Write-Host "    account $account in $Region" -ForegroundColor DarkGray

Write-Host "`n==> 2/5 Building the image" -ForegroundColor Cyan
docker info --format '{{.ServerVersion}}' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker is not running. Start Docker Desktop and re-run.'
}

docker build -t "${ImageName}:$ImageTag" -f (Join-Path $repoRoot 'services\timesfm\Dockerfile') $repoRoot
if ($LASTEXITCODE -ne 0) { throw 'Image build failed.' }

$localSizeMb = [math]::Round((docker image inspect "${ImageName}:$ImageTag" --format '{{.Size}}' | ForEach-Object { [double]$_ / 1MB }), 0)
Write-Host "    built ${ImageName}:$ImageTag ($localSizeMb MB)" -ForegroundColor DarkGray

Write-Host "`n==> 3/5 Publishing to ECR" -ForegroundColor Cyan
$repoName = $ImageName
# The repository is created by the stack, so on the first run create it here and
# let CloudFormation adopt it later.
$exists = aws ecr describe-repositories --registry-id $account --repository-names $repoName @awsArgs --query 'repositories[0].repositoryName' --output text 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "    creating repository $repoName" -ForegroundColor DarkGray
  aws ecr create-repository --registry-id $account --repository-name $repoName @awsArgs `
    --image-scanning-configuration scanOnPush=true `
    --image-tag-mutability MUTABLE | Out-Null
}

# ECR auth must be refreshed periodically; 12 hours is the client-side expiry.
$password = aws ecr get-login-password --region $Region --profile $Profile 2>$null
if (-not $password) { throw 'Could not obtain an ECR login password.' }
$password | docker login --username AWS --password-stdin aws.ecr.$Region.amazonaws.com 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker login failed.' }

$remote = "$account.dkr.ecr.$Region.amazonaws.com/${repoName}:$ImageTag"
docker tag "${ImageName}:$ImageTag" $remote
docker push $remote --quiet
if ($LASTEXITCODE -ne 0) { throw 'Image push failed.' }
Write-Host "    pushed $remote" -ForegroundColor DarkGray

if ($PushOnly) {
  Write-Host "`n    -PushOnly set. Image published, stack untouched." -ForegroundColor Yellow
  return
}

Write-Host "`n==> 4/5 Deploying the pipeline" -ForegroundColor Cyan
if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
node (Join-Path $repoRoot 'scripts\bundle-functions.mjs') (Join-Path $repoRoot 'backend') $stagingDir | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Bundle build failed.' }

$batchDir = Join-Path $stagingDir 'batch'
$batchZip = Join-Path $stagingDir 'batch.zip'
Compress-Archive -Path (Join-Path $batchDir '*') -DestinationPath $batchZip -Force
$codeKey = "atelier-predict-batch-$((Get-FileHash -Algorithm SHA256 -Path $batchZip).Hash.Substring(0, 12).ToLower()).zip"
aws s3 cp $batchZip "s3://$ArtifactBucket/$codeKey" @awsArgs --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Batch bundle upload failed.' }
Write-Host "    uploaded $codeKey" -ForegroundColor DarkGray

$paramList = @(
  "ParameterKey=ImageUri,ParameterValue=$remote",
  "ParameterKey=ArtifactBucket,ParameterValue=$ArtifactBucket",
  "ParameterKey=CodeKey,ParameterValue=$codeKey",
  "ParameterKey=ScheduleExpression,ParameterValue=$ScheduleExpression",
  "ParameterKey=ForecastBucketName,ParameterValue=$ForecastBucketName",
  "ParameterKey=CpuSize,ParameterValue=$CpuSize",
  "ParameterKey=MemorySize,ParameterValue=$MemorySize"
)

$template = Join-Path $PSScriptRoot 'template-timesfm.yaml'
aws cloudformation validate-template @awsArgs --template-body "file://$template" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'infra/template-timesfm.yaml is not valid CloudFormation.' }

$changeSetName = "tfm-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
aws cloudformation create-change-set @awsArgs --stack-name $StackName `
  --template-body "file://$template" --capabilities CAPABILITY_NAMED_IAM `
  --change-set-name $changeSetName --change-set-type CREATE `
  --parameters $paramList 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not create the change set.' }

$status = 'PENDING'
$deadline = (Get-Date).AddMinutes(5)
while ($status -match 'PENDING|IN_PROGRESS' -and (Get-Date) -lt $deadline) {
  $status = aws cloudformation describe-change-set @awsArgs --stack-name $StackName --change-set-name $changeSetName --query 'Status' --output text 2>$null
  if ($status -match 'IN_PROGRESS') { Start-Sleep -Seconds 3 }
}
if ($status -ne 'CREATE_COMPLETE') { throw "Change set is $status. Run describe-change-set for the reason." }

aws cloudformation execute-change-set @awsArgs --stack-name $StackName --change-set-name $changeSetName 2>&1 | Out-Null

do {
  Start-Sleep -Seconds 15
  $stackStatus = aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].StackStatus' --output text 2>$null
  Write-Host "    stack: $stackStatus" -ForegroundColor DarkGray
} while ($stackStatus -match 'IN_PROGRESS' -and (Get-Date) -lt (Get-Date).AddMinutes(20))

if ($stackStatus -ne 'CREATE_COMPLETE') { throw "Stack ended in $stackStatus." }

Write-Host "`n==> Deployed" -ForegroundColor Green
$outputs = aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' --output text 2>$null
foreach ($line in $outputs) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2) { Write-Host ("    {0,-20} {1}" -f $parts[0], $parts[1]) }
}

$serviceUrl = ($outputs | Where-Object { $_ -like 'TimesfmServiceUrl*' }) -split "`t" | Select-Object -Last 1

Write-Host "`n==> 5/5 Verifying the service" -ForegroundColor Cyan
Write-Host "    Waiting for the first healthy instance (up to 3 minutes)..."
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 10
  try {
    $health = Invoke-RestMethod -Uri "$serviceUrl/health" -TimeoutSec 15
    if ($health.model_loaded) {
      Write-Host ("    healthy, model loaded in {0}s" -f $health.load_seconds) -ForegroundColor Green
      $healthy = $true
      break
    }
  } catch {
    Write-Host "    still starting..." -ForegroundColor DarkGray
  }
}
if (-not $healthy) { Write-Host '    service did not become healthy in time; check the App Runner console.' -ForegroundColor Yellow }

if (-not $SkipTrigger) {
  Write-Host "`n    Triggering one refresh so you do not wait for the schedule..." -ForegroundColor Cyan
  aws lambda invoke @awsArgs --function-name atelier-predict-batch --payload '{}' /dev/null 2>&1 | Out-Null
  Write-Host '    invoked. Check the forecast bucket for forecast.json.' -ForegroundColor DarkGray
}

Write-Host "`n==> Next step: point the forecast Lambda at this bucket" -ForegroundColor Cyan
Write-Host "    Add FORECAST_BUCKET to the forecast function environment, then:" -ForegroundColor DarkGray
Write-Host "    ./infra/deploy.ps1" -ForegroundColor DarkGray
Write-Host "    Without it the champion keeps serving and nothing breaks." -ForegroundColor DarkGray