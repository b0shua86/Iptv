#!/usr/bin/env bash
#
# One-time setup for the Mac IPTV Server.
# Installs dependencies, creates config.json, and (optionally) sets the server
# to start automatically at login via launchd.
#
set -euo pipefail

APPDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APPDIR"

echo "==> Mac IPTV Server setup"
echo "    App directory: $APPDIR"
echo ""

# --- Check prerequisites ---------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed."
  echo "  Install it with Homebrew:  brew install node"
  exit 1
fi
NODE_BIN="$(command -v node)"
echo "==> Node found: $NODE_BIN ($(node --version))"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "WARNING: ffmpeg not found. Local-media transcoding & 24/7 loop channels"
  echo "         need it. Install with:  brew install ffmpeg"
fi

# --- Install npm deps ------------------------------------------------------
echo "==> Installing dependencies (npm install)…"
npm install --no-audit --no-fund

# --- Create config.json ----------------------------------------------------
if [ ! -f config.json ]; then
  cp config.example.json config.json
  echo ""
  echo "==> Created config.json from the example."
  echo "    EDIT IT NOW and set \"mediaDir\" to your media folder, e.g.:"
  echo "      \"mediaDir\": \"/Users/$(whoami)/Movies\""
  echo ""
else
  echo "==> config.json already exists — leaving it as-is."
fi

# --- Optional: install launchd auto-start ----------------------------------
read -r -p "Start the server automatically at login? [y/N] " ans
if [[ "${ans:-N}" =~ ^[Yy]$ ]]; then
  PLIST_SRC="$APPDIR/install/com.iptvserver.plist"
  PLIST_DST="$HOME/Library/LaunchAgents/com.iptvserver.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  sed -e "s#__NODE__#${NODE_BIN}#g" -e "s#__APPDIR__#${APPDIR}#g" "$PLIST_SRC" > "$PLIST_DST"
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  launchctl load "$PLIST_DST"
  echo "==> Installed and loaded launchd agent: $PLIST_DST"
  echo "    Logs: $APPDIR/iptv-server.log"
  echo "    Stop:  launchctl unload \"$PLIST_DST\""
else
  echo "==> Skipped auto-start. Run the server manually with:  npm start"
fi

echo ""
echo "==> Done. Find your server URL by running:  npm start"
echo "    Then add the Playlist URL to your TVs (see README.md)."
