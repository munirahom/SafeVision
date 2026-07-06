param(
    [switch]$InstallDeps,
    [switch]$NoLaunch,
    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $AppRoot "backend"
$FrontendDir = Join-Path $AppRoot "frontend"
$BackendVenvDir = Join-Path $BackendDir ".venv"
$BackendPython = Join-Path $BackendVenvDir "Scripts\python.exe"
$BackendRequirements = Join-Path $BackendDir "requirements.txt"
$BackendDepsStamp = Join-Path $BackendVenvDir ".requirements-stamp"
$FrontendPackageJson = Join-Path $FrontendDir "package.json"
$FrontendPackageLock = Join-Path $FrontendDir "package-lock.json"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"
$FrontendDepsStamp = Join-Path $FrontendDir ".node-deps-stamp"

function Get-RequiredCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names,
        [Parameter(Mandatory = $true)]
        [string]$Hint
    )

    foreach ($Name in $Names) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($Command) {
            return $Command.Source
        }
    }

    throw $Hint
}

function Get-StampValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (Test-Path $Path) {
        return (Get-Content $Path -Raw).Trim()
    }

    return ""
}

function Ensure-BackendEnvironment {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PythonLauncher
    )

    if (!(Test-Path $BackendPython)) {
        Write-Host "Creating backend virtual environment..." -ForegroundColor Cyan
        & $PythonLauncher -m venv $BackendVenvDir
    }

    $RequirementsHash = (Get-FileHash $BackendRequirements -Algorithm SHA256).Hash
    $NeedsInstall = $InstallDeps -or ((Get-StampValue -Path $BackendDepsStamp) -ne $RequirementsHash)

    if ($NeedsInstall) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
        & $BackendPython -m pip install --upgrade pip
        & $BackendPython -m pip install -r $BackendRequirements
        Set-Content -Path $BackendDepsStamp -Value $RequirementsHash -NoNewline
    }
}

function Ensure-FrontendEnvironment {
    $DependencySource = if (Test-Path $FrontendPackageLock) { $FrontendPackageLock } else { $FrontendPackageJson }
    $DependencyHash = (Get-FileHash $DependencySource -Algorithm SHA256).Hash
    $NeedsInstall = $InstallDeps -or !(Test-Path $FrontendNodeModules) -or ((Get-StampValue -Path $FrontendDepsStamp) -ne $DependencyHash)

    if ($NeedsInstall) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
        Push-Location $FrontendDir
        try {
            & $script:NodeCommand install
        }
        finally {
            Pop-Location
        }
        Set-Content -Path $FrontendDepsStamp -Value $DependencyHash -NoNewline
    }
}

function Start-ServerWindow {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $EscapedTitle = $Title.Replace("'", "''")
    $EscapedWorkingDirectory = $WorkingDirectory.Replace("'", "''")

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$EscapedTitle'; Set-Location '$EscapedWorkingDirectory'; $Command"
    ) | Out-Null
}

$PythonLauncher = Get-RequiredCommand -Names @("py", "python") -Hint "Python is not installed or not available on PATH."
$NodeCommand = Get-RequiredCommand -Names @("npm.cmd", "npm") -Hint "npm is not installed or not available on PATH."

Ensure-BackendEnvironment -PythonLauncher $PythonLauncher
Ensure-FrontendEnvironment

if ($NoLaunch) {
    Write-Host "SafeVision dependencies are ready. No processes launched because -NoLaunch was specified." -ForegroundColor Green
    return
}

$BackendCommand = "Write-Host 'Starting SafeVision backend on http://localhost:8000' -ForegroundColor Green; & '$BackendPython' -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
$FrontendCommand = "Write-Host 'Starting SafeVision frontend on http://localhost:5173' -ForegroundColor Green; & '$NodeCommand' run dev"

Start-ServerWindow -Title "SafeVision Backend" -WorkingDirectory $BackendDir -Command $BackendCommand
Start-Sleep -Seconds 2
Start-ServerWindow -Title "SafeVision Frontend" -WorkingDirectory $FrontendDir -Command $FrontendCommand

if (!$NoBrowser) {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5173" | Out-Null
}

Write-Host "SafeVision is starting in two PowerShell windows." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Yellow
