@echo off
rem FRAMEHAND local app: double-click on Windows (or run: run_ui.cmd)
rem Extra options are passed on, e.g. run_ui.cmd --no-open
setlocal
cd /d "%~dp0"
title FRAMEHAND
rem ffmpeg/ffprobe can also live in FRAMEHAND's own bin folder, or where winget puts them
set "PATH=%~dp0bin;%PATH%;%LOCALAPPDATA%\Microsoft\WinGet\Links"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  FRAMEHAND needs Node.js 22 or newer, and it is not installed.
  echo  We are opening the download page: pick "LTS", run the installer, then double-click this file again.
  start "" "https://nodejs.org/en/download"
  goto :fail
)
node -e "process.exit(+process.versions.node.split('.')[0] >= 22 ? 0 : 1)"
if errorlevel 1 (
  echo.
  echo  FRAMEHAND needs Node.js 22 or newer.
  for /f "delims=" %%v in ('node -v') do echo  This computer has %%v. Install the LTS version from the page that is opening, then double-click this file again.
  start "" "https://nodejs.org/en/download"
  goto :fail
)

set "MISSING="
where ffmpeg >nul 2>nul || set "MISSING=ffmpeg"
where ffprobe >nul 2>nul || set "MISSING=%MISSING% ffprobe"
if defined MISSING (
  echo.
  echo  FRAMEHAND needs FFmpeg to make the video files ^(not found: %MISSING%^).
  echo  Easiest: open PowerShell and run:  winget install -e --id Gyan.FFmpeg
  echo  Or download it from the page that is opening, and put ffmpeg.exe and ffprobe.exe
  echo  in a folder called "bin" inside this FRAMEHAND folder. Then double-click this file again.
  if not exist "%~dp0bin" mkdir "%~dp0bin"
  start "" "https://www.gyan.dev/ffmpeg/builds/"
  goto :fail
)

node -e "import('./cli/lib/browser.js').then((m) => process.exit(m.findChrome() ? 0 : 1)).catch(() => process.exit(1))"
if errorlevel 1 (
  echo.
  echo  FRAMEHAND needs Microsoft Edge or Google Chrome ^(it uses one, quietly, to draw each frame^).
  echo  Install Chrome from the page that is opening, then double-click this file again.
  start "" "https://www.google.com/chrome/"
  goto :fail
)

echo  Starting FRAMEHAND... your browser will open in a moment.
echo  Keep this window open while you use FRAMEHAND. Close it to quit.
echo.
node cli/om.js ui --port 7870 %*
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
if not defined FRAMEHAND_NO_PAUSE pause
exit /b 1
