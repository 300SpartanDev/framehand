# FRAMEHAND installer for Windows.
#   Open PowerShell, paste this line and press Enter:
#   irm https://raw.githubusercontent.com/300SpartanDev/framehand/main/install.ps1 | iex
# Puts FRAMEHAND in %USERPROFILE%\Framehand, adds a "Start Framehand" shortcut to your Desktop and opens the app.
# Your own videos and settings live in %APPDATA%\FRAMEHAND, outside this folder, so re-running this to update is safe.
# Everything runs inside one script block, so a problem never closes your PowerShell window.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'   # the progress bar makes downloads much slower in Windows PowerShell
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $Repo = '300SpartanDev/framehand'
  $Dest = Join-Path $env:USERPROFILE 'Framehand'

  function Say($m)  { Write-Host "> $m" -ForegroundColor DarkYellow }
  function Good($m) { Write-Host "  $m" -ForegroundColor Green }
  function Stop-WithHelp($m, $url) {
    Write-Host ''
    Write-Host "  $m" -ForegroundColor Red
    if ($url) { Start-Process $url }
    Write-Host ''
  }
  function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $links = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links'   # where winget puts ffmpeg.exe / ffprobe.exe
    $env:Path = "$machine;$user;$links;$(Join-Path $Dest 'bin')"
  }
  function Has($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }
  function Node-Ok {
    if (-not (Has 'node')) { return $false }
    try { return [int](& node -p "process.versions.node.split('.')[0]") -ge 22 } catch { return $false }
  }
  function Winget-Install($id, $what) {
    Say "Installing $what (this can take a minute)..."
    & winget install -e --id $id --accept-source-agreements --accept-package-agreements --silent
    Refresh-Path
  }

  if ($env:OS -ne 'Windows_NT') { Stop-WithHelp "This installer is for Windows. On a Mac, see https://github.com/$Repo"; return }

  # 1. The app itself
  Say 'Downloading FRAMEHAND...'
  $tmp = Join-Path $env:TEMP ("framehand-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp 'framehand.zip'
    Invoke-WebRequest -UseBasicParsing "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    Copy-Item -Path (Join-Path $tmp 'framehand-main\*') -Destination $Dest -Recurse -Force
  } catch {
    Stop-WithHelp "Could not download FRAMEHAND. Check your internet connection and paste the line again. ($($_.Exception.Message))"
    return
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
  Good "FRAMEHAND is in $Dest"
  Refresh-Path

  # 2. Node.js 22+ and FFmpeg, through winget (the app installer built into Windows 10 and 11)
  $needNode = -not (Node-Ok)
  $needFfmpeg = -not ((Has 'ffmpeg') -and (Has 'ffprobe'))
  if (($needNode -or $needFfmpeg) -and -not (Has 'winget')) {
    if ($needNode) { Start-Process 'https://nodejs.org/en/download' }
    if ($needFfmpeg) { Start-Process 'https://www.gyan.dev/ffmpeg/builds/' }
    Stop-WithHelp ("FRAMEHAND needs " + (@(if ($needNode) { 'Node.js (the LTS download)' }; if ($needFfmpeg) { 'FFmpeg' }) -join ' and ') + ". " +
      "Windows' app installer (winget) isn't on this computer, so we opened the download pages for you. " +
      "Install from there, then paste the line again. (You can also get 'App Installer' from the Microsoft Store, which adds winget.)")
    return
  }
  if ($needNode) { Winget-Install 'OpenJS.NodeJS.LTS' 'Node.js' }
  if (-not (Node-Ok)) { Stop-WithHelp 'Node.js 22 or newer is still missing. Install the LTS version from the page that just opened, then paste the line again.' 'https://nodejs.org/en/download'; return }
  Good "Node.js $(& node -v) is ready"
  if ($needFfmpeg) { Winget-Install 'Gyan.FFmpeg' 'FFmpeg (it makes the video files)' }
  if (-not ((Has 'ffmpeg') -and (Has 'ffprobe'))) {
    Stop-WithHelp 'FFmpeg is still missing. Close this window, open a new PowerShell and paste the line again. If that does not help, install FFmpeg from the page that just opened.' 'https://www.gyan.dev/ffmpeg/builds/'
    return
  }
  Good 'FFmpeg is ready'

  # 3. A browser to draw the frames: Microsoft Edge comes with Windows, Chrome works too
  Push-Location $Dest
  try { & node -e "import('./cli/lib/browser.js').then(m=>process.exit(m.findChrome()?0:1)).catch(()=>process.exit(1))" } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) {
    Stop-WithHelp 'FRAMEHAND needs Microsoft Edge or Google Chrome to draw the frames, and neither was found. Install Chrome from the page that just opened, then paste the line again.' 'https://www.google.com/chrome/'
    return
  }
  Good 'Browser found'

  # 4. Desktop shortcut
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcut = Join-Path $desktop 'Start Framehand.lnk'
  try {
    $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
    $lnk.TargetPath = Join-Path $Dest 'run_ui.cmd'
    $lnk.WorkingDirectory = $Dest
    $lnk.Description = 'Start FRAMEHAND'
    $lnk.Save()
  } catch {
    $shortcut = Join-Path $desktop 'Start Framehand.cmd'
    Set-Content -Path $shortcut -Value "@echo off`r`ncall `"$Dest\run_ui.cmd`"" -Encoding ASCII
  }
  Good 'Added "Start Framehand" to your Desktop'

  Write-Host ''
  Say 'Done! Double-click "Start Framehand" on your Desktop any time. Opening it now...'
  Write-Host '  (A small black window opens too. Keep it open while you use FRAMEHAND; close it to quit.)'
  if (-not $env:FRAMEHAND_NO_LAUNCH) { Start-Process -FilePath (Join-Path $Dest 'run_ui.cmd') -WorkingDirectory $Dest }
}
