#!/usr/bin/env bash

# Claude Code launcher — called by claudecode:// protocol handler
# URL format: claudecode:<path>?<command>?<tab-title>
# Example:    claudecode:/home/user/projects/my-app?/orchestrator task 14?Auth system

raw="$1"

# Strip protocol prefix
raw="${raw#claudecode:}"

# Remove leading slashes (browsers may add extras)
while [[ "$raw" == /* ]]; do
  # Keep at least one leading slash for absolute paths
  # Browser often sends claudecode:///home/... so strip down to /home/...
  if [[ "$raw" == //* ]]; then
    raw="${raw#/}"
  else
    break
  fi
done

# URL-decode
urldecode() {
  printf '%b' "${1//%/\\x}"
}

# Split on ? — path, command, title
IFS='?' read -r dir cmd title <<< "$raw"

dir="$(urldecode "$dir")"
cmd="$(urldecode "$cmd")"
title="$(urldecode "$title")"

# Defaults
[ -z "$cmd" ] && cmd="/orchestrator next"
[ -z "$title" ] && title="Claude Code"

# Validate command against allowlist (prevents injection via crafted URLs)
if [[ ! "$cmd" =~ ^/orchestrator\ (next|arrange|status|task\ [0-9]+|[0-9]+)$ ]] && [[ ! "$cmd" =~ ^Read\ \.maestro/ ]]; then
  echo "ERROR: Invalid command format: $cmd" >&2
  exit 1
fi

# Special: __launch_file runs .maestro/launch.sh (multi-tab launch)
if [ "$cmd" = "__launch_file" ]; then
  exec bash "$dir/.maestro/launch.sh"
fi

# Write launch script (avoids shell interpolation)
mkdir -p "$dir/.maestro"
script_path="$dir/.maestro/launch-single.sh"
cat > "$script_path" << SCRIPT_EOF
#!/bin/bash
cd "$(printf '%s' "$dir" | sed 's/"/\\"/g')" && claude --dangerously-skip-permissions "$(printf '%s' "$cmd" | sed 's/"/\\"/g')"; exec bash
SCRIPT_EOF
chmod +x "$script_path"

# Detect terminal emulator and launch
if command -v gnome-terminal &>/dev/null; then
  gnome-terminal --title="$title" --working-directory="$dir" -- bash "$script_path"
elif command -v kitty &>/dev/null; then
  kitty --title "$title" --directory "$dir" bash "$script_path"
elif command -v alacritty &>/dev/null; then
  alacritty --title "$title" --working-directory "$dir" -e bash "$script_path"
elif command -v xterm &>/dev/null; then
  xterm -title "$title" -e bash "$script_path"
else
  # Fallback: run in current terminal
  bash "$script_path"
fi
