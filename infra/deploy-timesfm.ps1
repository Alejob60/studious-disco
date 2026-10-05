<#
.SYNOPSIS
  Builds the inference image and deploys the optional challenger pipeline.

.DESCRIPTION
  Uses a Lambda container function, not App Runner: App Runner bills for the time
  a service exists and cannot scale to zero, which is the wrong shape for a job
  that runs once a night.

  The dashboard is fully functional without this. The forecast Lambda serves the
  Holt-Winters champion whenever no fresh forecast.json exists, so nothing here
  is required for the hackathon demo.

  Stages:
    1. Build the image locally and measure it uncompressed
    2. Create the ECR repository and push
    3. Bundle and upload the orchestrator Lambda
    4. Apply the CloudFormation stack
    5. Trigger one refresh so you do not wait for the schedule

.EXAMPLE
  ./infra/deploy-timesfm.ps1 -ImageTag 1.0.0

.EXAMPLE
  ./infra/deploy-timesfm.ps1 -PushOnly
#>
[CmdletBinding()]
param(
  [string]$Profile = 'default',
  [string]$Region = 'us-east-1',
  [string]$StackName = 'atelier-predict-timesfm',
  [string]$ImageTag = '1.0.0',
  [string]$ImageName = 'atelier-predict-forecast-model',
  [string]$ArtifactBucket = 'atelier-predict-artifacts-409514059726',
  [string]$ForecastBucketName = '',
  [string]$ScheduleExpression = 'cron(30 4 * * ? *)',
  [string]$CpuSize = '2 vCPU',
  [string]$MemorySize = '4 GB',
  [int]$InferenceTimeoutSeconds = 45,
  [switch]$PushOnly,
  [switch]$SkipTrigger
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$stagingDir = Join-Path $repoRoot 'infra\.staging-timesfm'
$resultFile = Join-Path $env:TEMP 'atelier-batch-result.json'
$awsArgs = @('--region', $Region, '--profile', $Profile)

Write-Host "`n==> 1/5 Verifying AWS credentials" -ForegroundColor Cyan
aws sts get-caller-identity @awsArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Not authenticated for profile '$Profile'." }
$account = (aws sts get-caller-identity @awsArgs --query Account --output text).Trim()
Write-Host "    account $account in $Region" -ForegroundColor DarkGray

Write-Host "`n==> 2/5 Building the image" -ForegroundColor Cyan
docker info --format '{{.ServerVersion}}' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker is not running. Start Docker Desktop and re-run.' }

# --provenance=false is not optional. BuildKit otherwise publishes an OCI image
# index carrying an attestation-manifest entry, and Lambda rejects it with
# "image manifest, config or layer media type ... is not supported" because it
# cannot parse an index. It only accepts a single manifest.
docker build --provenance=false --sbom=false `
  -t "${ImageName}:$ImageTag" -f (Join-Path $repoRoot 'services\timesfm\Dockerfile') $repoRoot
if ($LASTEXITCODE -ne 0) { throw 'Image build failed.' }

# Measured inside the image: about 2.0 MB->GB uncompressed, mostly the 883 MB
# checkpoint plus 769 MB of torch. `docker images` reports roughly 2.5x that
# because it also counts the builder-stage copies of the same content, so the
# useful number for the Lambda limit is the one measured here.
$runtimeMbRaw = docker run --rm --entrypoint sh "${ImageName}:$ImageTag" -c 'du -sm / 2>/dev/null | tail -1 | cut -f1'
if (-not $runtimeMbRaw) { throw 'Could not measure the image size.' }
$runtimeMb = [math]::Round(([double]$runtimeMbRaw) / 1024, 2)
Write-Host "    built ${ImageName}:$ImageTag (${runtimeMb} GB uncompressed)" -ForegroundColor DarkGray
if ($runtimeMb -gt 9.5) { throw "Image is ${runtimeMb} GB uncompressed, over the 10 GB Lambda container limit." }

Write-Host "`n==> 3/5 Publishing to the public registry" -ForegroundColor Cyan
# Public ECR gallery, not the private registry. This App Runner API has no
# AccessRoleArn parameter, so a private image cannot be authenticated at all:
# CreateService answers "Authentication configuration is invalid", and granting
# apprunner.amazonaws.com in the repository policy does not help. ECR_PUBLIC needs
# no role, which is the only path this API supports.
#
# This makes the image, checkpoint included, publicly pullable. The weights are
# Apache-2.0, so redistribution is permitted; the visibility decision is a human
# one and it is recorded here rather than buried in a script.
$publicRepoName = $ImageName
aws ecr-public create-repository --region us-east-1 --repository-name $publicRepoName 2>&1 | Out-Null
$repoUri = (aws ecr-public describe-repositories --region us-east-1 `
  --query "repositories[?repositoryName=='$publicRepoName'].repositoryUri" --output text 2>$null)
if (-not $repoUri -or $repoUri -match 'ERROR|None') {
  throw "Could not resolve the public repository URI for $publicRepoName."
}
Write-Host "    $repoUri" -ForegroundColor DarkGray

# Docker's credential store on this machine is the Windows helper and it fails on
# save, so the auth entry is written straight into an isolated config instead.
$dockerCfg = Join-Path $env:TEMP 'atelier-docker-public'
New-Item -ItemType Directory -Path $dockerCfg -Force | Out-Null
$pubPassword = aws ecr-public get-login-password --region us-east-1 2>$null
if (-not $pubPassword) { throw 'Could not obtain a public ECR login password.' }
$auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("AWS:$pubPassword"))
'{ "auths": { "public.ecr.aws": { "auth": "' + $auth + '" } } }' |
  Set-Content (Join-Path $dockerCfg 'config.json') -Encoding utf8

$remote = "${repoUri}:$ImageTag"
docker tag "${ImageName}:$ImageTag" $remote
# The flag has to precede the reference: docker takes everything after NAME[:TAG]
# as another target, so `push repo --quiet` tries to push a ref named --quiet.
docker --config $dockerCfg push --quiet $remote
if ($LASTEXITCODE -ne 0) { throw "Image push failed for $remote." }
Write-Host "    pushed $remote" -ForegroundColor DarkGray

if ($PushOnly) {
  Write-Host "`n    -PushOnly set. Image published, stack untouched." -ForegroundColor Yellow
  return
}

Write-Host "`n==> 4/5 Deploying the pipeline" -ForegroundColor Cyan
if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
node (Join-Path $repoRoot 'scripts\bundle-functions.mjs') (Join-Path $repoRoot 'backend') $stagingDir | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Bundle build failed.' }

$batchZip = Join-Path $stagingDir 'batch.zip'
Compress-Archive -Path (Join-Path $stagingDir 'batch\*') -DestinationPath $batchZip -Force
$codeKey = "atelier-predict-batch-$((Get-FileHash -Algorithm SHA256 -Path $batchZip).Hash.Substring(0, 12).ToLower()).zip"
aws s3 cp $batchZip "s3://$ArtifactBucket/$codeKey" @awsArgs --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Bundle upload failed.' }
Write-Host "    uploaded $codeKey" -ForegroundColor DarkGray

$paramList = @(
  "ParameterKey=ImageUri,ParameterValue=$remote",
    "ParameterKey=ArtifactBucket,ParameterValue=$ArtifactBucket",
  "ParameterKey=CodeKey,ParameterValue=$codeKey",
  "ParameterKey=ScheduleExpression,ParameterValue=$ScheduleExpression",
  "ParameterKey=ForecastBucketName,ParameterValue=$ForecastBucketName",
  "ParameterKey=CpuSize,ParameterValue=$CpuSize",
  "ParameterKey=MemorySize,ParameterValue=$MemorySize",
  "ParameterKey=InferenceTimeoutSeconds,ParameterValue=$InferenceTimeoutSeconds"
)

$template = Join-Path $PSScriptRoot 'template-timesfm.yaml'
aws cloudformation validate-template @awsArgs --template-body "file://$template" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'infra/template-timesfm.yaml is not valid CloudFormation.' }

$changeSetName = "tfm-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
$changeSetType = 'CREATE'

# A stack left in ROLLBACK_COMPLETE cannot accept a CREATE change set, and this
# script is meant to be re-runnable after a failed deploy.
$existing = aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].StackStatus' --output text 2>$null
if ($LASTEXITCODE -eq 0 -and $existing -eq 'ROLLBACK_COMPLETE') {
  Write-Host "    deleting the $existing stack from a previous attempt" -ForegroundColor DarkGray
  aws cloudformation delete-stack @awsArgs --stack-name $StackName 2>&1 | Out-Null
  do {
    Start-Sleep -Seconds 10
    $gone = aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].StackStatus' --output text 2>$null
  } while ($LASTEXITCODE -eq 0 -and (Get-Date) -lt (Get-Date).AddMinutes(10))
}
elseif ($LASTEXITCODE -eq 0 -and $existing -notmatch 'CREATE_COMPLETE|UPDATE_COMPLETE') {
  throw "Stack exists in $existing. Resolve it before deploying."
}
elseif ($LASTEXITCODE -eq 0) {
  $changeSetType = 'UPDATE'
  Write-Host "    stack exists ($existing): preparing an UPDATE" -ForegroundColor DarkGray
}

aws cloudformation create-change-set @awsArgs --stack-name $StackName `
  --template-body "file://$template" --capabilities CAPABILITY_NAMED_IAM `
  --change-set-name $changeSetName --change-set-type $changeSetType `
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

$deadline = (Get-Date).AddMinutes(25)
do {
  Start-Sleep -Seconds 15
  $stackStatus = aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].StackStatus' --output text 2>$null
  Write-Host "    stack: $stackStatus" -ForegroundColor DarkGray
} while ($stackStatus -match 'IN_PROGRESS' -and (Get-Date) -lt $deadline)

if ($stackStatus -ne 'CREATE_COMPLETE' -and $stackStatus -ne 'UPDATE_COMPLETE') {
  aws cloudformation describe-stack-events @awsArgs --stack-name $StackName `
    --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' --output text 2>$null |
    Select-Object -First 3 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
  throw "Stack ended in $stackStatus."
}

Write-Host "`n==> Deployed" -ForegroundColor Green
$outputs = aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' --output text 2>$null
foreach ($line in $outputs) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2) { Write-Host ("    {0,-24} {1}" -f $parts[0], $parts[1]) }
}

$serviceUrl = (($outputs | Where-Object { $_ -like 'InferenceServiceUrl*' }) -split "`t") | Select-Object -Last 1

Write-Host "`n==> Waiting for the inference service" -ForegroundColor Cyan
# The first instance pulls a ~2 GB image and loads the model, so this is minutes,
# not seconds. The service reports healthy before the model is resident, so
# model_loaded is the signal that matters.
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 15
  try {
    $health = Invoke-RestMethod -Uri "$serviceUrl/health" -TimeoutSec 15
    if ($health.model_loaded) {
      Write-Host ("    healthy, model loaded in {0}s" -f $health.load_seconds) -ForegroundColor Green
      $ready = $true
      break
    }
    Write-Host "    up but the model is still loading..." -ForegroundColor DarkGray
  } catch {
    Write-Host "    not reachable yet..." -ForegroundColor DarkGray
  }
}
if (-not $ready) { Write-Host '    the service did not report a loaded model in time.' -ForegroundColor Yellow }

if (-not $SkipTrigger) {
  Write-Host "`n==> 5/5 Triggering one refresh" -ForegroundColor Cyan
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  aws lambda invoke @awsArgs --cli-read-timeout 300 --function-name atelier-predict-batch --payload '{}' $resultFile 2>&1 | Out-Null
  $watch.Stop()
  Write-Host ("    orchestrator returned in {0:N0}s" -f $watch.Elapsed.TotalSeconds) -ForegroundColor DarkGray
  if (Test-Path $resultFile) {
    Write-Host "    $(Get-Content $resultFile -Raw)"
  }
}

Write-Host "`n==> Next step: point the forecast Lambda at this bucket" -ForegroundColor Cyan
Write-Host "    ./infra/deploy.ps1 -ForecastBucketName <bucket>" -ForegroundColor DarkGray
Write-Host "    Without it the champion keeps serving and nothing breaks." -ForegroundColor DarkGray
