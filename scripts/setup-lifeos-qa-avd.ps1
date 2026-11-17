$ErrorActionPreference = 'Stop'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$avdHome = if ($env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME } else { 'D:\LifeOS-Android-QA\avd' }
$avdName = 'LifeOS-QA'
$package = 'system-images;android-34;google_apis;x86_64'
$emulator = Join-Path $sdk 'emulator\emulator.exe'
$manager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
$avdManager = Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat'

foreach ($tool in @($emulator, $manager, $avdManager)) {
  if (-not (Test-Path $tool)) { throw "Required installed Android tool is missing: $tool" }
}
$driveRoot = [System.IO.Path]::GetPathRoot($avdHome)
$drive = Get-PSDrive -Name $driveRoot.TrimEnd(':\')
if (-not $drive -or $drive.Free -lt 10GB) { throw "AVD drive $driveRoot needs at least 10 GB free." }

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:ANDROID_AVD_HOME = $avdHome

$priorErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$installed = & $manager --sdk_root=$sdk --list_installed 2>&1 | Out-String
$managerExitCode = $LASTEXITCODE
$ErrorActionPreference = $priorErrorAction
if ($managerExitCode -ne 0) { throw 'Could not inspect installed SDK packages.' }
if ($installed -notmatch [regex]::Escape($package)) {
  & $manager --sdk_root=$sdk --install $package
  if ($LASTEXITCODE -ne 0) { throw 'SDK Manager did not complete the API 34 Google APIs x86_64 system image installation.' }
}

$registered = & $emulator -list-avds
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect registered AVDs.' }
if ($registered -contains $avdName) {
  $existingIni = Join-Path $avdHome "$avdName.ini"
  $existingConfig = Join-Path $avdHome "$avdName.avd\config.ini"
  if (-not (Test-Path $existingConfig)) { throw "The registered $avdName AVD has no config at the configured AVD home; it was left untouched." }
  Write-Output "Existing $avdName AVD found at $existingConfig. It was left unchanged."
  return
}

New-Item -ItemType Directory -Path $avdHome -Force | Out-Null
$avdManagerArgs = @('create','avd','-n',$avdName,'-k',$package,'-d','pixel_2')
& $avdManager @avdManagerArgs
if ($LASTEXITCODE -ne 0) { throw 'AVD Manager did not create the new LifeOS-QA AVD.' }

$configPath = Join-Path $avdHome "$avdName.avd\config.ini"
if (-not (Test-Path $configPath)) { throw "AVD Manager did not create $configPath" }
$settings = [ordered]@{
  'hw.ramSize' = '2048'
  'hw.cpu.ncore' = '2'
  'hw.lcd.width' = '720'
  'hw.lcd.height' = '1280'
  'hw.lcd.density' = '320'
  'hw.gpu.enabled' = 'yes'
  'hw.gpu.mode' = 'host'
  'disk.dataPartition.size' = '2G'
  'fastboot.forceColdBoot' = 'yes'
  'fastboot.forceFastBoot' = 'no'
  'firstboot.bootFromLocalSnapshot' = 'no'
  'firstboot.saveToLocalSnapshot' = 'no'
  'firstboot.bootFromDownloadableSnapshot' = 'no'
}
$lines = Get-Content $configPath
foreach ($key in $settings.Keys) {
  $pattern = '^\s*' + [regex]::Escape($key) + '\s*='
  $replacement = "$key=$($settings[$key])"
  $matches = @($lines | Where-Object { $_ -match $pattern })
  if ($matches.Count) {
    $first = $true
    $lines = @($lines | ForEach-Object {
      if ($_ -match $pattern) {
        if ($first) { $first = $false; $replacement }
      } else { $_ }
    })
  } else {
    $lines += $replacement
  }
}
Set-Content -Path $configPath -Value $lines -Encoding ascii

$verify = & $emulator -list-avds
if ($LASTEXITCODE -ne 0 -or $verify -notcontains $avdName) { throw 'LifeOS-QA was created but did not validate in the SDK AVD inventory.' }
Write-Output "PASS: Created $avdName (API 34 Google APIs x86_64) at $configPath."
Write-Output 'AVD settings: 2 GB RAM, 2 CPU cores, 720x1280 at 320 dpi, host graphics.'
