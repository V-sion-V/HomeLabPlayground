[CmdletBinding()]
param(
  [string]$ConfigPath,
  [string]$SshHost,
  [string]$SshUser,
  [int]$SshPort,
  [string]$IdentityFile,
  [string]$RemoteReleaseDir,
  [string]$RemoteBackupDir,
  [int]$PartyPort,
  [int]$HealthTimeoutSeconds
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:InvocationParameters = @{}
foreach ($entry in $PSBoundParameters.GetEnumerator()) {
  $script:InvocationParameters[$entry.Key] = $entry.Value
}
if (-not $script:InvocationParameters.ContainsKey("ConfigPath")) {
  $ConfigPath = Join-Path $PSScriptRoot "deploy.config.psd1"
}

function Write-Stage {
  param(
    [Parameter(Mandatory = $true)][string]$Stage,
    [Parameter(Mandatory = $true)][string]$Message
  )

  Write-Host ("[{0}] {1}" -f $Stage.ToUpperInvariant(), $Message)
}

function Invoke-NativeCapture {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$WorkingDirectory
  )

  $previousLocation = $null
  try {
    if ($WorkingDirectory) {
      $previousLocation = Get-Location
      Set-Location -LiteralPath $WorkingDirectory
    }

    $lines = @(& $Command @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    $text = (($lines | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).Trim()
    return [pscustomobject]@{
      ExitCode = $exitCode
      Output = $text
    }
  }
  finally {
    if ($null -ne $previousLocation) {
      Set-Location -LiteralPath $previousLocation
    }
  }
}

function Invoke-NativeLive {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Command @Arguments | ForEach-Object { Write-Host $_ }
  $exitCode = $LASTEXITCODE
  return [int]$exitCode
}

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($null -eq $command) {
    throw "Required command '$Name' was not found on PATH."
  }
  return $command.Source
}

function Read-Setting {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Config,
    [Parameter(Mandatory = $true)][string]$Name,
    $ParameterValue,
    $DefaultValue
  )

  if ($script:InvocationParameters.ContainsKey($Name)) {
    return $ParameterValue
  }
  if ($Config.ContainsKey($Name)) {
    return $Config[$Name]
  }
  return $DefaultValue
}

function ConvertTo-SafePosixArgument {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'" + $Value.Replace("'", "'""'""'") + "'"
}

function Assert-RemotePath {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  if (
    -not $Value.StartsWith("/") -or
    $Value -eq "/" -or
    $Value -notmatch "^/[A-Za-z0-9_./@%+=,-]+$"
  ) {
    throw "$Name must be an absolute POSIX path without spaces, shell metacharacters, or control characters."
  }

  $segments = $Value.Split("/", [System.StringSplitOptions]::RemoveEmptyEntries)
  if ($segments -contains "." -or $segments -contains "..") {
    throw "$Name cannot contain '.' or '..' path segments."
  }
}

function Assert-Port {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][int]$Value
  )

  if ($Value -lt 1 -or $Value -gt 65535) {
    throw "$Name must be between 1 and 65535."
  }
}

function Get-SshArguments {
  param(
    [Parameter(Mandatory = $true)][int]$Port,
    [string]$Identity
  )

  $arguments = @(
    "-p", $Port.ToString(),
    "-o", "ConnectTimeout=10",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=2"
  )
  if ($Identity) {
    $arguments += @("-i", $Identity)
  }
  return $arguments
}

function Get-ScpArguments {
  param(
    [Parameter(Mandatory = $true)][int]$Port,
    [string]$Identity
  )

  $arguments = @(
    "-P", $Port.ToString(),
    "-o", "ConnectTimeout=10",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=2"
  )
  if ($Identity) {
    $arguments += @("-i", $Identity)
  }
  return $arguments
}

$localTemporaryDirectory = $null
$remoteUploadCreated = $false
$remoteExecutionStarted = $false
$sshCommand = $null
$sshArguments = @()
$target = $null
$remoteUploadDirectory = $null

try {
  Write-Stage "preflight" "Loading deployment configuration."

  $config = @{}
  $configWasExplicit = $script:InvocationParameters.ContainsKey("ConfigPath")
  if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
    $loaded = Import-PowerShellDataFile -LiteralPath $ConfigPath
    foreach ($key in $loaded.Keys) {
      $config[$key] = $loaded[$key]
    }
  }
  elseif ($configWasExplicit) {
    throw "Configuration file '$ConfigPath' does not exist."
  }

  $allowedConfigKeys = @(
    "SshHost",
    "SshUser",
    "SshPort",
    "IdentityFile",
    "RemoteReleaseDir",
    "RemoteBackupDir",
    "PartyPort",
    "HealthTimeoutSeconds"
  )
  foreach ($key in $config.Keys) {
    if ($allowedConfigKeys -notcontains $key) {
      throw "Unknown deployment configuration key '$key'. Passwords and arbitrary options are not supported."
    }
  }

  $resolvedHost = [string](Read-Setting $config "SshHost" $SshHost $null)
  $resolvedUser = [string](Read-Setting $config "SshUser" $SshUser $null)
  $resolvedSshPort = [int](Read-Setting $config "SshPort" $SshPort 22)
  $resolvedIdentity = [string](Read-Setting $config "IdentityFile" $IdentityFile "")
  $resolvedReleaseDirectory = [string](
    Read-Setting $config "RemoteReleaseDir" $RemoteReleaseDir $null
  )
  $resolvedBackupDirectory = [string](
    Read-Setting $config "RemoteBackupDir" $RemoteBackupDir $null
  )
  $resolvedPartyPort = [int](Read-Setting $config "PartyPort" $PartyPort 3000)
  $resolvedHealthTimeout = [int](
    Read-Setting $config "HealthTimeoutSeconds" $HealthTimeoutSeconds 120
  )

  if (-not $resolvedHost -or $resolvedHost.StartsWith("-") -or $resolvedHost -notmatch "^[A-Za-z0-9._:-]+$") {
    throw "SshHost must be a DNS name or IP literal without whitespace or command options."
  }
  if (-not $resolvedUser -or $resolvedUser.StartsWith("-") -or $resolvedUser -notmatch "^[A-Za-z0-9._-]+$") {
    throw "SshUser contains unsupported characters."
  }
  Assert-Port "SshPort" $resolvedSshPort
  Assert-Port "PartyPort" $resolvedPartyPort
  if ($resolvedHealthTimeout -lt 10 -or $resolvedHealthTimeout -gt 1800) {
    throw "HealthTimeoutSeconds must be between 10 and 1800."
  }
  Assert-RemotePath "RemoteReleaseDir" $resolvedReleaseDirectory
  Assert-RemotePath "RemoteBackupDir" $resolvedBackupDirectory
  $resolvedReleaseDirectory = $resolvedReleaseDirectory.TrimEnd("/")
  $resolvedBackupDirectory = $resolvedBackupDirectory.TrimEnd("/")

  $releasePrefix = $resolvedReleaseDirectory.TrimEnd("/") + "/"
  $backupPrefix = $resolvedBackupDirectory.TrimEnd("/") + "/"
  if (
    $resolvedReleaseDirectory -eq $resolvedBackupDirectory -or
    $releasePrefix.StartsWith($backupPrefix, [StringComparison]::Ordinal) -or
    $backupPrefix.StartsWith($releasePrefix, [StringComparison]::Ordinal)
  ) {
    throw "RemoteReleaseDir and RemoteBackupDir cannot contain one another."
  }

  if ($resolvedIdentity) {
    if (-not [IO.Path]::IsPathRooted($resolvedIdentity)) {
      $identityBase = if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
        Split-Path -Parent (Resolve-Path -LiteralPath $ConfigPath).Path
      }
      else {
        (Get-Location).Path
      }
      $resolvedIdentity = Join-Path $identityBase $resolvedIdentity
    }
    if (-not (Test-Path -LiteralPath $resolvedIdentity -PathType Leaf)) {
      throw "IdentityFile '$resolvedIdentity' does not exist."
    }
    $resolvedIdentity = (Resolve-Path -LiteralPath $resolvedIdentity).Path
  }

  $gitCommand = Require-Command "git"
  $sshCommand = Require-Command "ssh"
  $scpCommand = Require-Command "scp"

  $repositoryResult = Invoke-NativeCapture $gitCommand @(
    "-C", (Join-Path $PSScriptRoot ".."), "rev-parse", "--show-toplevel"
  )
  if ($repositoryResult.ExitCode -ne 0 -or -not $repositoryResult.Output) {
    throw "Could not locate the Git repository root: $($repositoryResult.Output)"
  }
  $repositoryRoot = $repositoryResult.Output.Trim()

  $statusResult = Invoke-NativeCapture $gitCommand @(
    "-C", $repositoryRoot, "status", "--porcelain=v1", "--untracked-files=all"
  )
  if ($statusResult.ExitCode -ne 0) {
    throw "Could not inspect the Git workspace: $($statusResult.Output)"
  }
  if ($statusResult.Output) {
    throw "The Git workspace is not clean. Commit or remove all tracked and untracked changes before deployment."
  }

  $headResult = Invoke-NativeCapture $gitCommand @(
    "-C", $repositoryRoot, "rev-parse", "--verify", "HEAD^{commit}"
  )
  if ($headResult.ExitCode -ne 0 -or $headResult.Output -notmatch "^[0-9a-fA-F]{40}$") {
    throw "The current Git HEAD is not a valid commit."
  }
  $headSha = $headResult.Output.ToLowerInvariant()
  $image = "home-party-game-platform:$headSha"
  $target = "$resolvedUser@$resolvedHost"
  $sshArguments = @(Get-SshArguments $resolvedSshPort $resolvedIdentity)

  Write-Stage "preflight" "Checking remote release state for Git $headSha."
  $quotedRelease = ConvertTo-SafePosixArgument $resolvedReleaseDirectory
  $quotedImage = ConvertTo-SafePosixArgument $image
  $quotedHead = ConvertTo-SafePosixArgument $headSha
  $probeScript = @(
    "set -eu",
    "release=$quotedRelease",
    "expected_image=$quotedImage",
    "expected_sha=$quotedHead",
    'lock="${release}.deploy.lock"',
    'if ! mkdir "$lock" 2>/dev/null; then printf DEPLOY; exit 0; fi',
    'cleanup_probe() { rmdir "$lock" 2>/dev/null || true; }',
    'trap cleanup_probe 0 1 2 15',
    'if [ ! -f "$release/.release-sha" ] || [ ! -d "$release/deploy" ]; then printf DEPLOY; exit 0; fi',
    'marker=$(cat "$release/.release-sha" 2>/dev/null || true)',
    'cid=$(cd "$release/deploy" && docker compose ps -q home-table 2>/dev/null || true)',
    'if [ -z "$cid" ]; then printf DEPLOY; exit 0; fi',
    'running_image=$(docker inspect --format "{{.Config.Image}}" "$cid" 2>/dev/null || true)',
    'health=$(docker inspect --format "{{.State.Health.Status}}" "$cid" 2>/dev/null || true)',
    'if [ "$marker" = "$expected_sha" ] && [ "$running_image" = "$expected_image" ] && [ "$health" = "healthy" ]; then',
    '  printf NOOP',
    "else",
    '  printf DEPLOY',
    "fi"
  ) -join "`n"

  $probeResult = Invoke-NativeCapture $sshCommand ($sshArguments + @($target, $probeScript))
  if ($probeResult.ExitCode -ne 0) {
    throw "Remote preflight failed before upload: $($probeResult.Output)"
  }
  $probeLines = @($probeResult.Output -split "\r?\n")
  if ($probeLines -contains "NOOP") {
    Write-Stage "health" "Git $headSha is already running with the matching healthy image; deployment is a no-op."
    exit 0
  }

  $token = [Guid]::NewGuid().ToString("N").ToLowerInvariant()
  $localTemporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) "home-table-deploy-$token"
  [void](New-Item -ItemType Directory -Path $localTemporaryDirectory)
  $archivePath = Join-Path $localTemporaryDirectory "source.tar.gz"
  $remoteScriptPath = Join-Path $localTemporaryDirectory "remote-deploy.sh"

  Write-Stage "upload" "Creating a source archive from committed Git HEAD."
  $archiveResult = Invoke-NativeCapture $gitCommand @(
    "-C", $repositoryRoot, "archive", "--format=tar.gz", "--output=$archivePath", $headSha
  )
  if ($archiveResult.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Could not create the Git archive: $($archiveResult.Output)"
  }

  $scriptResult = Invoke-NativeCapture $gitCommand @(
    "-C", $repositoryRoot, "show", "${headSha}:deploy/remote-deploy.sh"
  )
  if ($scriptResult.ExitCode -ne 0 -or -not $scriptResult.Output) {
    throw "Committed HEAD does not contain deploy/remote-deploy.sh."
  }
  $normalizedRemoteScript = $scriptResult.Output.Replace("`r`n", "`n").TrimEnd("`r", "`n") + "`n"
  [IO.File]::WriteAllText(
    $remoteScriptPath,
    $normalizedRemoteScript,
    (New-Object Text.UTF8Encoding($false))
  )

  $archiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
  $scriptHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $remoteScriptPath).Hash.ToLowerInvariant()
  $remoteUploadDirectory = "$resolvedReleaseDirectory.upload.$token"
  $quotedUpload = ConvertTo-SafePosixArgument $remoteUploadDirectory

  $prepareUpload = @(
    "set -eu",
    "upload=$quotedUpload",
    'if [ -e "$upload" ]; then printf "Remote upload path already exists.\n" >&2; exit 1; fi',
    'umask 077',
    'mkdir "$upload"'
  ) -join "`n"
  $prepareResult = Invoke-NativeCapture $sshCommand ($sshArguments + @($target, $prepareUpload))
  if ($prepareResult.ExitCode -ne 0) {
    throw "Could not create the remote upload directory: $($prepareResult.Output)"
  }
  $remoteUploadCreated = $true

  $remoteDestination = "${target}:$remoteUploadDirectory/"
  $scpArguments = @(Get-ScpArguments $resolvedSshPort $resolvedIdentity) +
    @($archivePath, $remoteScriptPath, $remoteDestination)
  $scpExitCode = Invoke-NativeLive $scpCommand $scpArguments
  if ($scpExitCode -ne 0) {
    throw "SCP upload failed with exit code $scpExitCode."
  }

  Write-Stage "build" "Starting the locked remote deployment; the old service remains online during build."
  $remoteScript = "$remoteUploadDirectory/remote-deploy.sh"
  $remoteArchive = "$remoteUploadDirectory/source.tar.gz"
  $executeScript = @(
    "sh",
    (ConvertTo-SafePosixArgument $remoteScript),
    "deploy",
    (ConvertTo-SafePosixArgument $headSha),
    (ConvertTo-SafePosixArgument $remoteArchive),
    (ConvertTo-SafePosixArgument $archiveHash),
    (ConvertTo-SafePosixArgument $scriptHash),
    (ConvertTo-SafePosixArgument $resolvedReleaseDirectory),
    (ConvertTo-SafePosixArgument $resolvedBackupDirectory),
    $resolvedPartyPort.ToString(),
    $resolvedHealthTimeout.ToString(),
    (ConvertTo-SafePosixArgument $token)
  ) -join " "

  $remoteExecutionStarted = $true
  $remoteExitCode = Invoke-NativeLive $sshCommand ($sshArguments + @($target, $executeScript))
  if ($remoteExitCode -ne 0) {
    throw "Remote deployment failed with exit code $remoteExitCode. Review the remote recovery message above."
  }

  $remoteUploadCreated = $false
  Write-Stage "cleanup" "Deployment of Git $headSha completed successfully."
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  if ($remoteUploadCreated -and -not $remoteExecutionStarted -and $sshCommand -and $target) {
    try {
      $cleanupUpload = "rm -rf " + (ConvertTo-SafePosixArgument $remoteUploadDirectory)
      [void](Invoke-NativeCapture $sshCommand ($sshArguments + @($target, $cleanupUpload)))
    }
    catch {
      Write-Warning "The temporary remote upload could not be cleaned; remove '$remoteUploadDirectory' after confirming no deployment is active."
    }
  }

  if ($localTemporaryDirectory -and (Test-Path -LiteralPath $localTemporaryDirectory)) {
    $resolvedTemporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
    $resolvedLocalTemporary = [IO.Path]::GetFullPath($localTemporaryDirectory)
    if (
      $resolvedLocalTemporary.StartsWith(
        $resolvedTemporaryRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase
      ) -and
      (Split-Path -Leaf $resolvedLocalTemporary) -like "home-table-deploy-*"
    ) {
      Remove-Item -LiteralPath $resolvedLocalTemporary -Recurse -Force
    }
  }
}
