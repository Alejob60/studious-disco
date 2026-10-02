<#
.SYNOPSIS
  Builds and deploys the Atelier Predict serverless backend.

.DESCRIPTION
  There is no SAM/CDK CLI on this machine, so the bundle is produced with plain
  Node + Compress-Archive and deployed through `aws cloudformation deploy`.
  The same two Lambda handlers share one artifact.

.EXAMPLE
  ./infra/deploy.ps1
  ./infra/deploy.ps1 -Profile hackathon
#>
[CmdletBinding()]
param(
  [string]$Profile = 'default',
  [string]$Region = 'us-east-1',
  [string]$StackName = 'atelier-predict',
  [string]$ArtifactBucket = 'atelier-predict-artifacts-409514059726',
  [string]$ModelId = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  [string]$FoundationModelId = 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$stagingDir = Join-Path $repoRoot 'infra\.staging'
$zipPath = Join-Path $stagingDir 'atelier-predict.zip'
$awsArgs = @('--region', $Region, '--profile', $Profile)

Write-Host "`n==> 1/5 Verifying AWS credentials" -ForegroundColor Cyan
aws sts get-caller-identity @awsArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Not authenticated for profile '$Profile'." }
$account = (aws sts get-caller-identity @awsArgs --query Account --output text).Trim()
Write-Host "    account $account in $Region" -ForegroundColor DarkGray

Write-Host "`n==> 2/5 Staging Lambda bundle" -ForegroundColor Cyan
if (Test-Path $stagingDir) { Remove-Item -Recurse -Force $stagingDir }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

Copy-Item -Recurse -Path (Join-Path $backendDir 'shared') -Destination $stagingDir
Copy-Item -Recurse -Path (Join-Path $backendDir 'forecast') -Destination $stagingDir
Copy-Item -Recurse -Path (Join-Path $backendDir 'agent') -Destination $stagingDir

# node_modules belongs at the bundle root so that forecast/index.js and
# agent/index.js can both resolve it without nesting it inside one of them.
$agentModules = Join-Path $stagingDir 'node_modules'
if (Test-Path $agentModules) { Remove-Item -Recurse -Force $agentModules }
Copy-Item -Recurse -Path (Join-Path $backendDir 'node_modules') -Destination $agentModules

# The bundle root must not carry a package.json: "type": "module" or a "main"
# field here would change how Lambda loads the CommonJS handlers.
$stalePackageJson = Join-Path $stagingDir 'package.json'
if (Test-Path $stalePackageJson) { Remove-Item -Force $stalePackageJson }
Get-ChildItem -Path (Join-Path $stagingDir 'agent') -Filter 'package*.json' -File |
  ForEach-Object { Remove-Item -Force $_.FullName }

$testDir = Join-Path $stagingDir 'test'
if (Test-Path $testDir) { Remove-Item -Recurse -Force $testDir }

$fileCount = (Get-ChildItem -Recurse -File $stagingDir).Count
$sizeMb = [math]::Round(((Get-ChildItem -Recurse -File $stagingDir | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "    $fileCount files, $sizeMb MB staged" -ForegroundColor DarkGray

Write-Host "`n==> 3/5 Zipping" -ForegroundColor Cyan
# Compress-Archive would keep a top-level folder; Lambda needs the files at the
# root of the zip.
$zipStaging = Join-Path $stagingDir 'zip'
New-Item -ItemType Directory -Path $zipStaging | Out-Null
Copy-Item -Recurse -Force (Join-Path $stagingDir '*') -Destination $zipStaging -Exclude 'zip'
Compress-Archive -Path (Join-Path $zipStaging '*') -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $zipStaging

if ($SkipDeploy) {
  Write-Host "`n    -SkipDeploy set. Artifact ready at $zipPath" -ForegroundColor Yellow
  return
}

Write-Host "`n==> 4/5 Uploading to s3://$ArtifactBucket" -ForegroundColor Cyan
$bucketRegion = (aws s3api head-bucket --bucket $ArtifactBucket @awsArgs --query Region --output text 2>$null)
if ($LASTEXITCODE -ne 0) {
  Write-Host "    creating bucket" -ForegroundColor DarkGray
  aws s3api create-bucket --bucket $ArtifactBucket @awsArgs | Out-Null
  aws s3api put-public-access-block --bucket $ArtifactBucket @awsArgs `
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true | Out-Null
  Write-Host "    enabled full public access block" -ForegroundColor DarkGray
}

# CloudFormation only diffs the S3 key, not the object body. Reusing a fixed key
# makes every redeploy a silent no-op, so the hash of the bundle becomes the key.
$hash = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.Substring(0, 12).ToLower()
$codeKey = "atelier-predict-$hash.zip"
aws s3 cp $zipPath "s3://$ArtifactBucket/$codeKey" @awsArgs --only-show-errors
Write-Host "    uploaded $codeKey" -ForegroundColor DarkGray

Write-Host "`n==> 5/5 Deploying CloudFormation stack '$StackName'" -ForegroundColor Cyan
$template = Join-Path $PSScriptRoot 'template.yaml'

# Fail fast on a malformed template instead of surfacing a generic hook error.
aws cloudformation validate-template @awsArgs --template-body "file://$template" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "infra/template.yaml is not valid CloudFormation." }

# `aws cloudformation deploy` is bypassed on purpose: on this machine its
# --template-file path trips a spurious EarlyValidation failure, and it also
# reuses the previous value for any parameter that is not passed explicitly,
# which silently pinned a stale Bedrock model ID once already.
# Every parameter is therefore listed here.
$paramList = @(
  "ParameterKey=ArtifactBucket,ParameterValue=$ArtifactBucket",
  "ParameterKey=CodeKey,ParameterValue=$codeKey",
  "ParameterKey=BedrockModelId,ParameterValue=$ModelId",
  "ParameterKey=BedrockFoundationModelId,ParameterValue=$FoundationModelId"
)

$stackExists = (aws cloudformation describe-stacks @awsArgs --stack-name $StackName --query 'Stacks[0].StackId' --output text 2>$null)
$changeType = if ([bool]$stackExists) { 'UPDATE' } else { 'CREATE' }
$changeSetName = "ap-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"

Write-Host "    $changeType change set: $changeSetName" -ForegroundColor DarkGray

aws cloudformation create-change-set @awsArgs `
  --stack-name $StackName `
  --template-body "file://$template" `
  --capabilities CAPABILITY_NAMED_IAM `
  --change-set-name $changeSetName `
  --change-set-type $changeType `
  --parameters $paramList 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not create the CloudFormation change set." }

$changeSetStatus = aws cloudformation describe-change-set @awsArgs --stack-name $StackName `
  --change-set-name $changeSetName --query 'Status' --output text 2>$null

if ($changeSetStatus -ne 'CREATE_COMPLETE') {
  Write-Host "    change set status: $changeSetStatus" -ForegroundColor Red
  aws cloudformation describe-stack-events @awsArgs --stack-name $StackName `
    --query 'StackEvents[?ResourceStatus==`FAILED`].[LogicalResourceId,ResourceStatusReason]' --output text 2>$null |
    Select-Object -First 6 | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
  throw "Change set '$changeSetName' is $changeSetStatus."
}

$hasChanges = aws cloudformation describe-change-set @awsArgs --stack-name $StackName `
  --change-set-name $changeSetName --query 'length(Changes[?ResourceType==`AWS::CloudFormation::WaitConditionHandle`] || Changes[0])' --output text 2>$null

if ($hasChanges -eq '0') {
  Write-Host "    no changes to apply" -ForegroundColor DarkGray
  aws cloudformation delete-change-set @awsArgs --stack-name $StackName --change-set-name $changeSetName 2>&1 | Out-Null
} else {
  aws cloudformation execute-change-set @awsArgs --stack-name $StackName --change-set-name $changeSetName 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to execute change set '$changeSetName'." }

  $deadline = (Get-Date).AddMinutes(10)
  do {
    Start-Sleep -Seconds 10
    $stackStatus = aws cloudformation describe-stacks @awsArgs --stack-name $StackName `
      --query 'Stacks[0].StackStatus' --output text 2>$null
    Write-Host "    stack: $stackStatus" -ForegroundColor DarkGray
  } while ($stackStatus -match 'IN_PROGRESS' -and (Get-Date) -lt $deadline)

  if ($stackStatus -notmatch 'COMPLETE$') {
    aws cloudformation describe-stack-events @awsArgs --stack-name $StackName `
      --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' --output text 2>$null |
      Select-Object -First 6 | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
    throw "Stack ended in $stackStatus."
  }
}

$outputPairs = aws cloudformation describe-stacks @awsArgs --stack-name $StackName `
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' --output text 2>$null

Write-Host "`n==> Deployed (code $codeKey)" -ForegroundColor Green
foreach ($line in $outputPairs) {
  $parts = ($line -split "`t")
  if ($parts.Count -ge 2) { Write-Host ("    {0,-20} {1}" -f $parts[0], $parts[1]) }
}

$apiUrl = ($outputPairs | Where-Object { $_ -like 'ApiUrl*' }) -split "`t" | Select-Object -Last 1
Write-Host "`nSmoke test:" -ForegroundColor Cyan
Write-Host "    curl.exe $apiUrl/forecast"
