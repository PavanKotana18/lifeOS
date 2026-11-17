$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$dirty = git status --porcelain --untracked-files=normal
if ($LASTEXITCODE -ne 0) { throw 'Could not verify the source worktree.' }
if ($dirty) { throw 'Commit the preview variant changes first so the APK can record an exact source commit.' }
$sourceCommit = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceCommit -notmatch '^[0-9a-f]{40}$') {
    throw 'Could not identify the exact source commit.'
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
$npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npm -or -not $npx) { throw 'Node.js npm/npx command shims are required.' }

Write-Output 'Building current LifeOS web assets.'
& $npm.Source run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE." }

Write-Output 'Synchronizing the current web assets into Capacitor Android.'
& $npx.Source cap sync android
if ($LASTEXITCODE -ne 0) { throw "npx cap sync android failed with exit code $LASTEXITCODE." }

$localAppData = $env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($localAppData)) { throw 'LOCALAPPDATA is unavailable.' }
$signingDirectory = Join-Path $localAppData 'LifeOS\signing\preview'
$keystorePath = Join-Path $signingDirectory 'lifeos-preview-debug.p12'
$passwordPath = Join-Path $signingDirectory 'lifeos-preview-password.dpapi'
$keyAlias = 'lifeos-preview-debug'
$repoPrefix = $repoRoot.TrimEnd('\') + '\'
if ($signingDirectory.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Preview signing files must remain outside the repository.'
}

if (-not (Test-Path -LiteralPath $signingDirectory)) {
    New-Item -ItemType Directory -Path $signingDirectory | Out-Null
    $acl = Get-Acl -LiteralPath $signingDirectory
    $acl.SetAccessRuleProtection($true, $false)
    $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
    foreach ($sid in @($currentSid, $systemSid)) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $sid,
            [System.Security.AccessControl.FileSystemRights]::FullControl,
            [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit',
            [System.Security.AccessControl.PropagationFlags]::None,
            [System.Security.AccessControl.AccessControlType]::Allow
        )
        $acl.SetAccessRule($rule)
    }
    Set-Acl -LiteralPath $signingDirectory -AclObject $acl
}

if ((Test-Path -LiteralPath $keystorePath) -and -not (Test-Path -LiteralPath $passwordPath)) {
    throw 'The preview keystore exists but its DPAPI password record is missing; refusing to replace the signing identity.'
}

if (Test-Path -LiteralPath $passwordPath) {
    $encryptedPassword = [System.IO.File]::ReadAllText($passwordPath)
    $securePassword = ConvertTo-SecureString -String $encryptedPassword
    $password = [System.Net.NetworkCredential]::new('', $securePassword).Password
} else {
    if (Test-Path -LiteralPath $keystorePath) {
        throw 'A preview keystore exists without its protected password; refusing to regenerate it.'
    }
    $randomBytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($randomBytes)
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
    $securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force
    $encryptedPassword = ConvertFrom-SecureString -SecureString $securePassword
    [System.IO.File]::WriteAllText($passwordPath, $encryptedPassword, [System.Text.Encoding]::ASCII)
}

$javaHome = $env:JAVA_HOME
$keytoolPath = if ($javaHome) { Join-Path $javaHome 'bin\keytool.exe' } else { $null }
if (-not $keytoolPath -or -not (Test-Path -LiteralPath $keytoolPath)) {
    $keytoolCommand = Get-Command keytool.exe -ErrorAction SilentlyContinue
    if (-not $keytoolCommand) { throw 'JDK keytool.exe was not found.' }
    $keytoolPath = $keytoolCommand.Source
}

$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $localAppData 'Android\Sdk')) |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) }
if (-not $sdkCandidates) { throw 'Android SDK was not found.' }
$androidSdk = $sdkCandidates[0]

$oldPreviewEnvironment = @{}
$previewEnvironmentNames = @(
    'LIFEOS_PREVIEW_KEYSTORE_PATH', 'LIFEOS_PREVIEW_KEYSTORE_PASSWORD',
    'LIFEOS_PREVIEW_KEY_ALIAS', 'LIFEOS_PREVIEW_KEY_PASSWORD',
    'LIFEOS_PREVIEW_SOURCE_COMMIT', 'LIFEOS_PREVIEW_CERT_SHA256',
    'ANDROID_HOME', 'ANDROID_SDK_ROOT'
)
foreach ($name in $previewEnvironmentNames) {
    $oldPreviewEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    $env:LIFEOS_PREVIEW_KEYSTORE_PASSWORD = $password
    $env:LIFEOS_PREVIEW_KEY_PASSWORD = $password

    if (-not (Test-Path -LiteralPath $keystorePath)) {
        Write-Output 'Creating the separate LifeOS Preview signing identity outside the repository.'
        $keytoolArgs = @(
            '-genkeypair', '-keystore', $keystorePath, '-storetype', 'PKCS12',
            '-alias', $keyAlias, '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
            '-dname', 'CN=LifeOS Preview Debug, OU=Development, O=LifeOS, C=IN',
            '-storepass:env', 'LIFEOS_PREVIEW_KEYSTORE_PASSWORD',
            '-keypass:env', 'LIFEOS_PREVIEW_KEY_PASSWORD'
        )
        & $keytoolPath @keytoolArgs
        if ($LASTEXITCODE -ne 0) { throw "Preview keystore generation failed with exit code $LASTEXITCODE." }
    }

    $validateArgs = @(
        '-list', '-keystore', $keystorePath, '-storetype', 'PKCS12', '-alias', $keyAlias,
        '-storepass:env', 'LIFEOS_PREVIEW_KEYSTORE_PASSWORD'
    )
    & $keytoolPath @validateArgs *> $null
    if ($LASTEXITCODE -ne 0) { throw 'The existing preview keystore or protected password record did not validate; no replacement was made.' }

    $certificatePath = Join-Path $signingDirectory ('.preview-certificate-' + [Guid]::NewGuid().ToString('N') + '.der')
    try {
        $exportArgs = @(
            '-exportcert', '-keystore', $keystorePath, '-storetype', 'PKCS12', '-alias', $keyAlias,
            '-storepass:env', 'LIFEOS_PREVIEW_KEYSTORE_PASSWORD', '-file', $certificatePath
        )
        & $keytoolPath @exportArgs *> $null
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the certificate from the preview keystore.' }
        $expectedSignerSha256 = (Get-FileHash -LiteralPath $certificatePath -Algorithm SHA256).Hash.ToLowerInvariant()
    } finally {
        Remove-Item -LiteralPath $certificatePath -Force -ErrorAction SilentlyContinue
    }

    $env:LIFEOS_PREVIEW_KEYSTORE_PATH = $keystorePath
    $env:LIFEOS_PREVIEW_KEY_ALIAS = $keyAlias
    $env:LIFEOS_PREVIEW_SOURCE_COMMIT = $sourceCommit
    $env:ANDROID_HOME = $androidSdk
    $env:ANDROID_SDK_ROOT = $androidSdk

    $gradlePath = Join-Path $localAppData 'Programs\LifeOS-Tools\gradle-8.2.1\bin\gradle.bat'
    if (-not (Test-Path -LiteralPath $gradlePath)) {
        $gradleCommand = Get-Command gradle.bat -ErrorAction SilentlyContinue
        if (-not $gradleCommand) { throw 'Gradle 8.2.1 was not found.' }
        $gradlePath = $gradleCommand.Source
    }

    Write-Output 'Assembling the isolated preview build type.'
    & $gradlePath -p android --no-daemon :app:assemblePreview
    if ($LASTEXITCODE -ne 0) { throw "Gradle preview assembly failed with exit code $LASTEXITCODE." }
} finally {
    foreach ($name in $previewEnvironmentNames) {
        $oldValue = $oldPreviewEnvironment[$name]
        if ($null -eq $oldValue) {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        } else {
            [Environment]::SetEnvironmentVariable($name, $oldValue, 'Process')
        }
    }
    $password = $null
    $securePassword = $null
    $encryptedPassword = $null
}

$apkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\preview\app-preview.apk'
if (-not (Test-Path -LiteralPath $apkPath)) { throw "Gradle completed without producing the expected APK: $apkPath" }

$buildToolsRoot = Join-Path $sdkCandidates[0] 'build-tools'
$buildTools = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
    Sort-Object { try { [Version]$_.Name } catch { [Version]'0.0' } } -Descending |
    Where-Object { (Test-Path (Join-Path $_.FullName 'aapt.exe')) -and (Test-Path (Join-Path $_.FullName 'apksigner.bat')) } |
    Select-Object -First 1
if (-not $buildTools) { throw 'Installed Android build-tools do not contain aapt and apksigner.' }
$aaptPath = Join-Path $buildTools.FullName 'aapt.exe'
$apksignerPath = Join-Path $buildTools.FullName 'apksigner.bat'

$badging = & $aaptPath dump badging $apkPath 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw 'aapt could not read the preview APK manifest.' }
if ($badging -notmatch "(?m)^package: name='com\.lifeos\.personal\.preview' versionCode='([^']+)' versionName='([^']+)'") {
    throw 'Preview APK package or version identity did not match the isolated preview variant.'
}
$versionCode = $Matches[1]
$versionName = $Matches[2]
if ($badging -notmatch "(?m)^application-label:'LifeOS Preview'$") { throw 'Preview APK app label was not LifeOS Preview.' }

$manifest = & $aaptPath dump xmltree $apkPath AndroidManifest.xml 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $manifest -notmatch 'com\.lifeos\.personal\.preview\.SOURCE_COMMIT' -or $manifest -notmatch [regex]::Escape($sourceCommit)) {
    throw 'Preview APK manifest does not carry the exact committed source SHA.'
}

$signatureOutput = & $apksignerPath verify --print-certs $apkPath 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or $signatureOutput -notmatch '(?m)^Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]{64})$') {
    throw 'APK signature verification failed or did not report a signer fingerprint.'
}
$signerSha256 = $Matches[1].ToLowerInvariant()
if ($signerSha256 -ne $expectedSignerSha256) { throw 'APK signer does not match the separate preview keystore.' }

$apkSha256 = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash
$apkTimestamp = (Get-Item -LiteralPath $apkPath).LastWriteTime.ToString('o')
$downloads = Join-Path $env:USERPROFILE 'Downloads'
if (-not (Test-Path -LiteralPath $downloads)) { New-Item -ItemType Directory -Path $downloads | Out-Null }
$outputName = "LifeOS-Preview-$($sourceCommit.Substring(0, 12)).apk"
$outputPath = Join-Path $downloads $outputName
$reportPath = [System.IO.Path]::ChangeExtension($outputPath, '.txt')
while ((Test-Path -LiteralPath $outputPath) -or (Test-Path -LiteralPath $reportPath)) {
    $outputPath = Join-Path $downloads "LifeOS-Preview-$($sourceCommit.Substring(0, 12))-$(Get-Date -Format 'yyyyMMdd-HHmmss-fff').apk"
    $reportPath = [System.IO.Path]::ChangeExtension($outputPath, '.txt')
}
Copy-Item -LiteralPath $apkPath -Destination $outputPath
if ((Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash -ne $apkSha256) {
    throw 'Copied preview APK checksum did not match the build output.'
}

$report = @(
    'LifeOS Preview — DEVELOPMENT PREVIEW, not a production release',
    "Source commit: $sourceCommit",
    'Package: com.lifeos.personal.preview',
    'App label: LifeOS Preview',
    "Version: $versionName ($versionCode)",
    "APK created: $apkTimestamp",
    "APK SHA-256: $apkSha256",
    "Signer certificate SHA-256: $signerSha256",
    "APK: $outputPath"
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($reportPath, $report, [System.Text.Encoding]::UTF8)
Write-Output $report
