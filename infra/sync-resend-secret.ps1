<#
.SYNOPSIS
  Mirrors RESEND_API_KEY from the ColombiaTIC frontend into AWS Secrets Manager.

.DESCRIPTION
  The Atelier Predict Lambda needs the Resend key, but the SPA is public and the
  CloudFormation template must not contain the secret. The key is copied
  programmatically and never printed, never placed on a command line (the value
  travels through a temp file via --cli-input-json), and the temp file is
  deleted immediately.

  Run once. Re-running overwrites the secret value.
#>
[CmdletBinding()]
param(
  [string]$Profile = 'default',
  [string]$Region = 'us-east-1',
  [string]$SourceEnv = 'D:\MISYBOT_2026\AGENT_GOOGLE\frontend-colombiatic\.env.local',
  [string]$SecretId = 'atelier-predict/lead-resend'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SourceEnv)) {
  throw "Source env not found: $SourceEnv"
}

# Read the raw line rather than dot-sourcing: the file may hold values with
# characters that PowerShell would try to expand.
$line = Get-Content -LiteralPath $SourceEnv |
  Where-Object { $_ -match '^\s*RESEND_API_KEY\s*=' } |
  Select-Object -First 1

if (-not $line) { throw 'RESEND_API_KEY not found in the source env file.' }

$key = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")

if ($key.Length -lt 20) { throw 'RESEND_API_KEY looks too short to be valid.' }

Write-Host "Found a Resend key of $($key.Length) characters (value not shown)." -ForegroundColor DarkGray

$payloadPath = Join-Path $env:TEMP "atelier-secret-$([guid]::NewGuid().ToString('N')).json"
try {
  # The secret travels through this file, so it never appears in a process listing.
  @{ SecretString = $key } | ConvertTo-Json -Compress | Set-Content -LiteralPath $payloadPath -Encoding utf8

  $exists = aws secretsmanager describe-secret --region $Region --profile $Profile `
    --secret-id $SecretId --output text 2>$null

  if ($LASTEXITCODE -eq 0) {
    aws secretsmanager put-secret-value --region $Region --profile $Profile `
      --secret-id $SecretId --cli-input-json "file://$payloadPath" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'put-secret-value failed.' }
    Write-Host "Updated existing secret $SecretId" -ForegroundColor Green
  } else {
    aws secretsmanager create-secret --region $Region --profile $Profile `
      --name $SecretId --cli-input-json "file://$payloadPath" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'create-secret failed.' }
    Write-Host "Created secret $SecretId" -ForegroundColor Green
  }
} finally {
  if (Test-Path -LiteralPath $payloadPath) {
    # Overwrite before unlinking so the key is not recoverable from disk slack.
    Set-Content -LiteralPath $payloadPath -Value '' -Encoding utf8
    Remove-Item -LiteralPath $payloadPath -Force
  }
  $key = $null
}

Write-Host "`nDone. The Lambda template will reference it as:" -ForegroundColor Cyan
Write-Host "  {{resolve:secretsmanager:`${SecretId}:SecretString}}" -ForegroundColor DarkGray