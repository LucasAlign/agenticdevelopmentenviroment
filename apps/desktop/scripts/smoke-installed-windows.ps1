param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,
    [string]$InstallDirectory = (Join-Path $env:RUNNER_TEMP "ade-beta-install"),
    [string]$DataDirectory = (Join-Path $env:RUNNER_TEMP "ade-beta-data")
)

$ErrorActionPreference = "Stop"
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installDirectory = [IO.Path]::GetFullPath($InstallDirectory)
$dataDirectory = [IO.Path]::GetFullPath($DataDirectory)
$executable = Join-Path $installDirectory "ADE.exe"
$uninstaller = Join-Path $installDirectory "Uninstall ADE.exe"
$sentinel = Join-Path $dataDirectory "preserve-on-uninstall.txt"
$process = $null

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
"preserve ADE data" | Set-Content -LiteralPath $sentinel -Encoding utf8

function Invoke-AndRequireSuccess {
    param([string]$FilePath, [string[]]$ArgumentList)

    $started = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -Wait -PassThru
    if ($started.ExitCode -ne 0) {
        throw "$FilePath exited with code $($started.ExitCode)"
    }
}

try {
    Invoke-AndRequireSuccess -FilePath $installer -ArgumentList @("/S", "/D=$installDirectory")

    if (-not (Test-Path -LiteralPath $executable)) {
        throw "Installed ADE executable is missing: $executable"
    }
    if (-not (Test-Path -LiteralPath $uninstaller)) {
        throw "ADE uninstaller is missing: $uninstaller"
    }

    $startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
    $startMenuShortcut = Get-ChildItem -LiteralPath $startMenu -Filter "ADE.lnk" -File -Recurse |
        Select-Object -First 1
    if (-not $startMenuShortcut) {
        throw "ADE Start Menu shortcut was not created"
    }

    $desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "ADE.lnk"
    if (-not (Test-Path -LiteralPath $desktopShortcut)) {
        throw "Default-on ADE desktop shortcut was not created"
    }

    $startInfo = [Diagnostics.ProcessStartInfo]::new($executable)
    $startInfo.UseShellExecute = $false
    $startInfo.Environment["ADE_HOME_DIR"] = $dataDirectory
    $startInfo.Environment["PATH"] = "$env:SystemRoot\System32;$env:SystemRoot"
    $startInfo.Environment.Remove("NODE_PATH")
    $startInfo.Environment.Remove("BUN_INSTALL")
    $process = [Diagnostics.Process]::Start($startInfo)

    Start-Sleep -Seconds 20
    if ($process.HasExited) {
        throw "Installed ADE exited during the clean-PATH startup smoke test with code $($process.ExitCode)"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory "local.db"))) {
        throw "Installed ADE did not create and migrate its local database"
    }
}
finally {
    if ($process -and -not $process.HasExited) {
        taskkill.exe /PID $process.Id /T /F | Out-Null
    }

    if (Test-Path -LiteralPath $uninstaller) {
        Invoke-AndRequireSuccess -FilePath $uninstaller -ArgumentList @("/S")
        for ($attempt = 0; $attempt -lt 20 -and (Test-Path -LiteralPath $executable); $attempt++) {
            Start-Sleep -Milliseconds 500
        }
    }
}

if (Test-Path -LiteralPath $executable) {
    throw "ADE executable remains after uninstall: $executable"
}
if (-not (Test-Path -LiteralPath $sentinel)) {
    throw "ADE data was removed during uninstall: $sentinel"
}

Write-Output "Installed Windows smoke test passed; ADE data was preserved at $dataDirectory"
