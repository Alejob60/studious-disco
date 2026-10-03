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
  [string]$ResendSecretName = 'atelier-predict/lead-resend',
  [string]$LeadNotificationEmail = 'enterprise@colombiatic.com.co',
  [string]$LeadFromEmail = 'ColombiaTIC <onboarding@colombiatic.com.co>',
  [string]$LeadSourceTag = 'atelier-predict-hackathon',
[string]$CrmApiBase = '',
  [string]$ForecastBucketName = '',
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$stagingDir = Join-Path $repoRoot 'infra\.staging'
$awsArgs = @('--region', $Region, '--profile', $Profile)
# One bundle per function. By default the forecast function ships no AWS SDK, so it
# goes from a 2.4 MB download to roughly 10 KB zipped on the path that runs on every
# page load. Pointing it at a bucket switches the TimesFM challenger on, which needs
# the S3 SDK and costs that bundle about 8.4 MB: an explicit trade, so it is opt-in.
$Functions = @('forecast', 'agent', 'lead')
$bundleArgs = @()
if ($ForecastBucketName) {
  $bundleArgs += '--with-s3'
  Write-Host 'Forecast bucket set: packaging the S3 SDK for the challenger path.' -ForegroundColor Yellow
}

Write-Host "`n==> 1/4 Verifying AWS credentials" -ForegroundColor Cyan
aws sts get-caller-identity @awsArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Not authenticated for profile '$Profile'." }
$account = (aws sts get-caller-identity @awsArgs --query Account --output text).Trim()
Write-Host "    account $account in $Region" -ForegroundColor DarkGray

Write-Host "`n==> 2/4 Bundling each function separately" -ForegroundColor Cyan
node (Join-Path $repoRoot 'scripts\bundle-functions.mjs') $backendDir $stagingDir @bundleArgs
if ($LASTEXITCODE -ne 0) { throw 'Bundle build failed.' }

# Content hash per bundle: CloudFormation only diffs the S3 key, so a fixed key
# turns every redeploy into a silent no-op.
$codeKeys = @{}
foreach ($fn in $Functions) {
  $bundleDir = Join-Path $stagingDir $fn
  if (-not (Test-Path $bundleDir)) { throw "Missing bundle for $fn." }

  $zipPath = Join-Path $stagingDir "$fn.zip"
  Compress-Archive -Path (Join-Path $bundleDir '*') -DestinationPath $zipPath -Force

  $sizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB, 0)
  $hash = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.Substring(0, 12).ToLower()
  $codeKeys[$fn] = "atelier-predict-$fn-$hash.zip"

  Write-Host ("    {0,-10} {1,6} KB -> {2}" -f $fn, $sizeKb, $codeKeys[$fn]) -ForegroundColor DarkGray
}

if ($SkipDeploy) {
  Write-Host "`n    -SkipDeploy set. Bundles are ready in $stagingDir" -ForegroundColor Yellow
  return
}

Write-Host "`n==> 3/4 Uploading to s3://$ArtifactBucket" -ForegroundColor Cyan
$bucketExists = (aws s3api head-bucket --bucket $ArtifactBucket @awsArgs --query Region --output text 2>$null)
if ($LASTEXITCODE -ne 0) {
  Write-Host "    creating bucket" -ForegroundColor DarkGray
  aws s3api create-bucket --bucket $ArtifactBucket @awsArgs | Out-Null
  aws s3api put-public-access-block --bucket $ArtifactBucket @awsArgs `
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true | Out-Null
  Write-Host "    enabled full public access block" -ForegroundColor DarkGray
}

foreach ($fn in $Functions) {
  $zipPath = Join-Path $stagingDir "$fn.zip"
  aws s3 cp $zipPath "s3://$ArtifactBucket/$($codeKeys[$fn])" @awsArgs --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Upload failed for $fn." }
  Write-Host "    uploaded $($codeKeys[$fn])" -ForegroundColor DarkGray
}

Write-Host "`n==> 4/4 Deploying CloudFormation stack '$StackName'" -ForegroundColor Cyan
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
  "ParameterKey=CodeKey,ParameterValue=$($codeKeys['agent'])",
  "ParameterKey=ForecastCodeKey,ParameterValue=$($codeKeys['forecast'])",
  "ParameterKey=LeadCodeKey,ParameterValue=$($codeKeys['lead'])",
  "ParameterKey=BedrockModelId,ParameterValue=$ModelId",
  "ParameterKey=BedrockFoundationModelId,ParameterValue=$FoundationModelId",
  "ParameterKey=ResendSecretName,ParameterValue=$ResendSecretName",
  "ParameterKey=LeadNotificationEmail,ParameterValue=$LeadNotificationEmail",
  "ParameterKey=LeadFromEmail,ParameterValue=$LeadFromEmail",
  "ParameterKey=LeadSourceTag,ParameterValue=$LeadSourceTag",
  "ParameterKey=CrmApiBase,ParameterValue=$CrmApiBase",
"ParameterKey=ForecastBucketName,ParameterValue=$ForecastBucketName"
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

# The change set reports CREATE_IN_PROGRESS for a few seconds before settling, so
# poll instead of judging the first response.
$changeSetStatus = 'PENDING'
$changeDeadline = (Get-Date).AddMinutes(5)
while ($changeSetStatus -match 'PENDING|IN_PROGRESS' -and (Get-Date) -lt $changeDeadline) {
  $changeSetStatus = aws cloudformation describe-change-set @awsArgs --stack-name $StackName `
    --change-set-name $changeSetName --query 'Status' --output text 2>$null
  if ($changeSetStatus -match 'IN_PROGRESS') { Start-Sleep -Seconds 3 }
}

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

Write-Host "`n==> Deployed" -ForegroundColor Green
foreach ($line in $outputPairs) {
  $parts = ($line -split "`t")
  if ($parts.Count -ge 2) { Write-Host ("    {0,-20} {1}" -f $parts[0], $parts[1]) }
}

$apiUrl = ($outputPairs | Where-Object { $_ -like 'ApiUrl*' }) -split "`t" | Select-Object -Last 1
Write-Host "`nSmoke test:" -ForegroundColor Cyan
Write-Host "    curl.exe $apiUrl/forecast"



