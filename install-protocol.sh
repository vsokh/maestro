#!/usr/bin/env bash

# Registers claudecode:// protocol handler on Linux (XDG)
# No root required — installs to user's local applications

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$SCRIPT_DIR/claude-launcher.sh"
DESKTOP_FILE="$HOME/.local/share/applications/claudecode-handler.desktop"

# Ensure launcher is executable
chmod +x "$LAUNCHER"

# Create .desktop file
mkdir -p "$HOME/.local/share/applications"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Claude Code Launcher
Comment=Handler for claudecode:// protocol
Exec=$LAUNCHER %u
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/claudecode;
EOF

# Register as handler for claudecode:// URLs
xdg-mime default claudecode-handler.desktop x-scheme-handler/claudecode

# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null

echo ""
echo "  Done! claudecode:// links will now launch Claude Code."
echo ""
echo "  Handler: $LAUNCHER"
echo ""
