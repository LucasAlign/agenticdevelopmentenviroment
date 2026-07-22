@echo off
cd /d "%~dp0.."

set "BUN_EXE="
for %%I in (bun.exe) do set "BUN_EXE=%%~$PATH:I"
if not defined BUN_EXE (
	for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Oven-sh.Bun_*") do (
		if exist "%%~fD\bun-windows-x64\bun.exe" set "BUN_EXE=%%~fD\bun-windows-x64\bun.exe"
	)
)

if not defined BUN_EXE (
	echo Bun was not found on PATH.
	echo Install Bun or restart Windows after installing it, then try again.
	pause
	exit /b 1
)

"%BUN_EXE%" run --cwd apps/desktop dev
if errorlevel 1 (
	echo.
	echo ADE development startup failed. Review the errors above.
	pause
)
