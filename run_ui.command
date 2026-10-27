#!/bin/bash
# FRAMEHAND local app — double-click on macOS (or: ./run_ui.command)
cd "$(dirname "$0")"
# ffmpeg/ffprobe can live in FRAMEHAND's own bin/ folder or ~/bin (no Homebrew needed), or anywhere on the usual paths
export PATH="$PWD/bin:$HOME/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

# say(title, message, url): a Mac alert with a button that opens the download page; plain text elsewhere
say() {
  if command -v osascript >/dev/null 2>&1; then
    local r
    r=$(osascript -e "button returned of (display alert \"FRAMEHAND\" message \"$1\" buttons {\"Close\", \"Open download page\"} default button 2)" 2>/dev/null)
    [ "$r" = "Open download page" ] && [ -n "$2" ] && open "$2"
  else
    echo "FRAMEHAND: $1"; [ -n "$2" ] && echo "  Download: $2"
  fi
}

if ! command -v node >/dev/null; then
  say "Node.js 22 or newer is needed. Install it from nodejs.org (the LTS download), then double-click this file again." "https://nodejs.org/en/download"
  exit 1
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  say "Node.js 22 or newer is needed (you have $(node -v)). Install it from nodejs.org, then double-click this file again." "https://nodejs.org/en/download"
  exit 1
fi

missing=""
command -v ffmpeg >/dev/null 2>&1 || missing="ffmpeg"
command -v ffprobe >/dev/null 2>&1 || missing="${missing:+$missing and }ffprobe"
if [ -n "$missing" ]; then
  say "FFmpeg is needed to make the videos ($missing not found).

Easiest on a Mac: download ffmpeg and ffprobe from evermeet.cx/ffmpeg (or ffmpeg.org/download.html), unzip them and put both files in the 'bin' folder inside this FRAMEHAND folder. Then double-click this file again.

(If you use Homebrew you can instead run: brew install ffmpeg)" "https://evermeet.cx/ffmpeg/"
  mkdir -p bin
  exit 1
fi

if ! node -e "import('./cli/lib/browser.js').then((m) => process.exit(m.findChrome() ? 0 : 1)).catch(() => process.exit(1))"; then
  say "Google Chrome is needed (FRAMEHAND uses it, quietly, to draw each frame). Install it from google.com/chrome, then double-click this file again. Chromium, Edge or Brave also work." "https://www.google.com/chrome/"
  exit 1
fi

exec node cli/om.js ui --port 7870
