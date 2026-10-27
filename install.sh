#!/bin/bash
# FRAMEHAND installer for macOS.
#   curl -fsSL https://raw.githubusercontent.com/300SpartanDev/framehand/main/install.sh | bash
# Puts FRAMEHAND in ~/Framehand, adds a "Start Framehand" shortcut to your Desktop and opens the app.
# Your own videos and settings live outside this folder, so re-running this to update is safe.
set -e
REPO="300SpartanDev/framehand"
DEST="$HOME/Framehand"
say() { printf '\033[1;38;5;202m▶\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m✖\033[0m %s\n' "$1"; exit 1; }

[ "$(uname)" = "Darwin" ] || fail "This installer is for Mac. On other systems, see https://github.com/$REPO"
export PATH="$DEST/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
HAS_BREW=0; command -v brew >/dev/null 2>&1 && HAS_BREW=1

say "Downloading FRAMEHAND…"
TMP="$(mktemp -d)"
curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar xz -C "$TMP"
mkdir -p "$DEST"
cp -R "$TMP"/framehand-main/. "$DEST"/
rm -rf "$TMP"
chmod +x "$DEST/run_ui.command"

# Node.js 22+
NODE_OK=0
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then NODE_OK=1; fi
if [ $NODE_OK = 0 ]; then
  if [ $HAS_BREW = 1 ]; then say "Installing Node.js…"; brew install node
  else open "https://nodejs.org/en/download"; fail "Please install Node.js (the LTS download) from the page that just opened, then run this installer again."; fi
fi

# FFmpeg + FFprobe
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  if [ $HAS_BREW = 1 ]; then say "Installing FFmpeg…"; brew install ffmpeg
  else
    say "Downloading FFmpeg…"
    mkdir -p "$DEST/bin"
    for t in ffmpeg ffprobe; do
      curl -fsSL "https://evermeet.cx/ffmpeg/getrelease/$t/zip" -o "$DEST/bin/$t.zip"
      (cd "$DEST/bin" && unzip -oq "$t.zip" && rm "$t.zip" && chmod +x "$t" && xattr -d com.apple.quarantine "$t" 2>/dev/null || true)
    done
  fi
fi

# Google Chrome (or Chromium / Edge / Brave)
if ! (cd "$DEST" && node -e "import('./cli/lib/browser.js').then(m=>process.exit(m.findChrome()?0:1)).catch(()=>process.exit(1))"); then
  open "https://www.google.com/chrome/"
  fail "FRAMEHAND needs Google Chrome to draw the frames. Install it from the page that just opened, then run this installer again."
fi

# Desktop shortcut
cat > "$HOME/Desktop/Start Framehand.command" <<SHORTCUT
#!/bin/bash
exec "$DEST/run_ui.command"
SHORTCUT
chmod +x "$HOME/Desktop/Start Framehand.command"

say "Done! Double-click \"Start Framehand\" on your Desktop any time. Opening it now…"
open "$HOME/Desktop/Start Framehand.command"
