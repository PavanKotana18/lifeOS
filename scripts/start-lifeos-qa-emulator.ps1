param(
  [int]$BootTimeoutSeconds = 300,
  [double]$MinimumFreeMemoryGB = 3.5
)

$ErrorActionPreference = 'Stop'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$avdHome = if ($env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME } else { 'D:\LifeOS-Android-QA\avd' }
$avdName = 'LifeOS-QA'
$serial = 'emulator-5554'
$emulator = Join-Path $sdk 'emulator\emulator.exe'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$image = Join-Path $sdk 'system-images\android-34\google_apis\x86_64\package.xml'
$avdPath = Join-Path $avdHome "$avdName.avd"
$logDir = Split-Path $avdHome -Parent
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutPath = Join-Path $logDir "mission06-emulator-$runStamp.stdout.log"
$stderrPath = Join-Path $logDir "mission06-emulator-$runStamp.stderr.log"
$resourceLogPath = Join-Path $logDir "mission06-resource-monitor-$runStamp.csv"
$minimumFreeDuringBootGB = 2.25

function Invoke-ExplicitAdb([string[]]$Arguments) {
  $priorErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & $adb -s $serial @Arguments 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $priorErrorAction
  return [pscustomobject]@{ Output = $output.Trim(); ExitCode = $exitCode }
}

function Get-LifeOSQemuProcess {
  @(Get-CimInstance Win32_Process -Filter "Name = 'qemu-system-x86_64-headless.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match '(?:^|\s)-avd\s+LifeOS-QA(?:\s|$)' -and $_.CommandLine -match '(?:^|\s)-port\s+5554(?:\s|$)' })
}

function Write-ResourceSample($Qemu, $PreviousSample) {
  $now = Get-Date
  $os = Get-CimInstance Win32_OperatingSystem
  $freeMB = [math]::Round($os.FreePhysicalMemory / 1KB, 0)
  $qemuStats = if ($Qemu) { Get-Process -Id $Qemu.ProcessId -ErrorAction SilentlyContinue } else { $null }
  $workingMB = if ($qemuStats) { [math]::Round($qemuStats.WorkingSet64 / 1MB, 0) } else { 0 }
  $privateMB = if ($qemuStats) { [math]::Round($qemuStats.PrivateMemorySize64 / 1MB, 0) } else { 0 }
  $cpuSeconds = if ($qemuStats) { [math]::Round($qemuStats.CPU, 2) } else { 0 }
  $logical = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
  $cpuPercent = ''
  if ($PreviousSample -and $qemuStats) {
    $seconds = ($now - $PreviousSample.Time).TotalSeconds
    if ($seconds -gt 0 -and $logical -gt 0) {
      $cpuPercent = [math]::Round((($cpuSeconds - $PreviousSample.Cpu) / $seconds / $logical) * 100, 1)
    }
  }
  $line = '"{0}",{1},{2},{3},{4},{5},{6}' -f $now.ToString('o'),$(if($Qemu){$Qemu.ProcessId}else{''}),$freeMB,$workingMB,$privateMB,$cpuSeconds,$cpuPercent
  Add-Content -LiteralPath $resourceLogPath -Value $line
  return [pscustomobject]@{ Time = $now; Cpu = $cpuSeconds; FreeGB = [math]::Round($freeMB / 1024, 2) }
}

function Stop-LifeOSQemu($Qemu) {
  if (-not $Qemu) { return }
  $kill = Invoke-ExplicitAdb @('emu','kill')
  if ($kill.ExitCode -eq 0) { Add-Content -LiteralPath $resourceLogPath -Value ('"{0}",shutdown,adb-emu-kill' -f (Get-Date).ToString('o')) }
  $stopDeadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Seconds 1
    $remaining = Get-LifeOSQemuProcess | Where-Object ProcessId -eq $Qemu.ProcessId
  } while ($remaining -and (Get-Date) -lt $stopDeadline)
  if ($remaining) {
    # The command line was verified as this launch's LifeOS-QA AVD on port 5554.
    Stop-Process -Id $Qemu.ProcessId -Force -ErrorAction SilentlyContinue
    Add-Content -LiteralPath $resourceLogPath -Value ('"{0}",cleanup,stopped-exact-LifeOS-QA-qemu-pid-{1}' -f (Get-Date).ToString('o'),$Qemu.ProcessId)
  }
}

if (-not (Test-Path $emulator) -or -not (Test-Path $adb) -or -not (Test-Path $image)) {
  throw 'Android Emulator, platform-tools, or the API 34 Google APIs x86_64 image is missing.'
}
if (-not (Test-Path (Join-Path $avdPath 'config.ini'))) {
  throw "The disposable $avdName AVD is not configured at $avdPath."
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_AVD_HOME = $avdHome

$accel = & $emulator -accel-check 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $accel -notmatch 'WHPX.*usable') {
  throw "Hardware acceleration is not ready. No emulator was started. $($accel.Trim())"
}

$freeGB = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 2)
if ($freeGB -lt $MinimumFreeMemoryGB) {
  throw "Only $freeGB GB RAM is currently free; need at least $MinimumFreeMemoryGB GB to start the 2 GB guest. No emulator was started."
}
$battery = Get-CimInstance -Namespace root\wmi -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $battery) { throw 'Could not verify AC power status; refusing to start an emulator.' }
if (-not $battery.PowerOnline -or $battery.Critical) {
  throw "AC power is not available or Windows reports critical battery state (PowerOnline=$($battery.PowerOnline), Critical=$($battery.Critical)). No emulator was started."
}

$existingEmulator = Get-Process -Name emulator,qemu-system-x86_64,qemu-system-x86_64-headless -ErrorAction SilentlyContinue
if ($existingEmulator) {
  throw 'An Android emulator process is already running. The launcher will not enumerate or select connected devices.'
}
$portInUse = Get-NetTCPConnection -State Listen -LocalPort 5554 -ErrorAction SilentlyContinue
if ($portInUse) {
  throw 'Local emulator port 5554 is already in use. No ADB device list was queried and no emulator was started.'
}

$avds = & $emulator -list-avds
if ($LASTEXITCODE -ne 0 -or $avds -notcontains $avdName) {
  throw "The $avdName AVD is not registered with this SDK."
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
if ((Test-Path -LiteralPath $stdoutPath) -or (Test-Path -LiteralPath $stderrPath) -or (Test-Path -LiteralPath $resourceLogPath)) {
  throw 'Mission 06 evidence path already exists; no existing boot logs will be overwritten.'
}
Set-Content -LiteralPath $resourceLogPath -Value 'timestamp,pid,host_free_mb,qemu_working_set_mb,qemu_private_mb,qemu_cpu_seconds_total,qemu_cpu_percent_host' -Encoding ascii
$process = Start-Process -FilePath $emulator -ArgumentList @(
  '-avd', $avdName, '-port', '5554', '-cores', '2', '-memory', '2048',
  '-gpu', 'host', '-no-boot-anim', '-no-snapshot', '-no-window'
) -WorkingDirectory (Split-Path $emulator) -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru

$deadline = (Get-Date).AddSeconds($BootTimeoutSeconds)
$previousSample = $null
$qemu = $null
try {
  do {
    Start-Sleep -Seconds 5
    $qemuMatches = Get-LifeOSQemuProcess
    if ($qemuMatches.Count -gt 1) { throw 'Multiple LifeOS-QA QEMU processes matched port 5554; refusing to select one.' }
    $qemu = $qemuMatches | Select-Object -First 1
    $sample = Write-ResourceSample $qemu $previousSample
    $previousSample = $sample
    if (-not $qemu -and $process.HasExited) { throw "Emulator process exited before its LifeOS-QA QEMU instance appeared. See $stdoutPath and $stderrPath" }
    if ($sample.FreeGB -lt $minimumFreeDuringBootGB) {
      throw "Free RAM dropped to $($sample.FreeGB) GB during boot, below the $minimumFreeDuringBootGB GB runtime floor."
    }
    if (-not $qemu) { continue }
    $boot = Invoke-ExplicitAdb @('shell','getprop','sys.boot_completed')
    if ($boot.ExitCode -eq 0 -and $boot.Output -eq '1') { break }
  } while ((Get-Date) -lt $deadline)

  if (-not $qemu -or (Get-Date) -ge $deadline) { throw "Boot timed out after $BootTimeoutSeconds seconds. See $stdoutPath, $stderrPath, and $resourceLogPath" }
  $qemuProperty = Invoke-ExplicitAdb @('shell','getprop','ro.kernel.qemu')
  $avdResponse = Invoke-ExplicitAdb @('emu','avd','name')
  $runningName = ($avdResponse.Output -split '\r?\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne 'OK' } | Select-Object -First 1)
  if ($qemuProperty.ExitCode -ne 0 -or $avdResponse.ExitCode -ne 0 -or $qemuProperty.Output -ne '1' -or $runningName -ne $avdName) {
    throw "Selected serial $serial did not validate as the running $avdName AVD."
  }
  Write-Output "PASS: $serial booted into $runningName with WHPX acceleration."
  $qemuMatches = Get-LifeOSQemuProcess
  if ($qemuMatches.Count -eq 1) { $qemu = $qemuMatches[0]; Write-ResourceSample $qemu $previousSample | Out-Null }
  Stop-LifeOSQemu $qemu
  Write-Output "The verification boot was shut down cleanly. Resource log: $resourceLogPath"
} catch {
  if (-not $qemu) {
    $qemuMatches = Get-LifeOSQemuProcess
    if ($qemuMatches.Count -eq 1) { $qemu = $qemuMatches[0] }
  }
  Stop-LifeOSQemu $qemu
  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  throw
}
