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

# Special: __launch_file runs .devmanager/launch.sh (multi-tab launch)
if [ "$cmd" = "__launch_file" ]; then
  exec bash "$dir/.devmanager/launch.sh"
fi

# Detect terminal emulator and launch
if command -v gnome-terminal &>/dev/null; then
  gnome-terminal --title="$title" --working-directory="$dir" -- bash -c "claude --dangerously-skip-permissions '$cmd'; exec bash"
elif command -v kitty &>/dev/null; then
  kitty --title "$title" --directory "$dir" bash -c "claude --dangerously-skip-permissions '$cmd'; exec bash"
elif command -v alacritty &>/dev/null; then
  alacritty --title "$title" --working-directory "$dir" -e bash -c "claude --dangerously-skip-permissions '$cmd'; exec bash"
elif command -v xterm &>/dev/null; then
  xterm -title "$title" -e "cd '$dir' && claude --dangerously-skip-permissions '$cmd'; exec bash"
else
  # Fallback: run in current terminal
  cd "$dir" && claude --dangerously-skip-permissions "$cmd"
fi
