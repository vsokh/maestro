@echo off
setlocal enabledelayedexpansion

:: Claude Code launcher — called by claudecode:// protocol handler
:: URL format: claudecode:<path>?<command>?<tab-title>
:: Example:    claudecode:C:/Users/vsoko/Projects/therapy-desk?/orchestrator task 14?Auth system

:: Capture full command line (%* preserves spaces that %~1 would split on)
set "raw=%*"
:: Strip surrounding quotes if present
set "raw=!raw:"=!"

:: Strip protocol prefix
set "raw=!raw:claudecode:=!"

:: Remove leading slashes (browsers may add them)
:strip
if "!raw:~0,1!"=="/" set "raw=!raw:~1!" & goto strip

:: Split on ? — path, command, title
set "dir="
set "cmd="
set "title="
for /f "tokens=1,2,3 delims=?" %%a in ("!raw!") do (
  set "dir=%%a"
  set "cmd=%%b"
  set "title=%%c"
)

:: Convert forward slashes to backslashes in path
set "dir=!dir:/=\!"

:: URL-decode spaces
set "dir=!dir:%%20= !"
if defined cmd set "cmd=!cmd:%%20= !"
if defined cmd set "cmd=!cmd:+= !"
if defined title set "title=!title:%%20= !"
if defined title set "title=!title:+= !"

:: Defaults
if not defined cmd set "cmd=/orchestrator next"
if not defined title set "title=Claude Code"

:: Special: __launch_file runs .devmanager/launch.cmd (multi-tab launch)
if "!cmd!"=="__launch_file" (
  call "!dir!\.devmanager\launch.cmd"
  exit /b
)

:: Write temp script to avoid cmd.exe nested-quote hell
:: Quoting "/orchestrator arrange" as a single arg only works in a standalone script
set "tmpfile=%TEMP%\claude-launch-%RANDOM%.cmd"
(
  echo @echo off
  echo title !title!
  echo claude --dangerously-skip-permissions "!cmd!"
) > "!tmpfile!"

:: Launch as new tab in existing Windows Terminal (or new window if none open)
:: --suppressApplicationTitle prevents claude from overriding the tab name
start "" wt.exe -w 0 new-tab --title "!title!" --suppressApplicationTitle -d "!dir!" cmd /k "!tmpfile!"
