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

:: URL-decode all parameters (handles %20, %3F, %23, etc.)
for /f "usebackq delims=" %%x in (`powershell -NoProfile -Command "[System.Uri]::UnescapeDataString('!dir!')"`) do set "dir=%%x"
if defined cmd for /f "usebackq delims=" %%x in (`powershell -NoProfile -Command "[System.Uri]::UnescapeDataString('!cmd!')"`) do set "cmd=%%x"
if defined title for /f "usebackq delims=" %%x in (`powershell -NoProfile -Command "[System.Uri]::UnescapeDataString('!title!')"`) do set "title=%%x"

:: Defaults
if not defined cmd set "cmd=/orchestrator next"
if not defined title set "title=Claude Code"

:: Special: __launch_file runs .devmanager/launch.cmd (multi-tab launch)
if "!cmd!"=="__launch_file" (
  call "!dir!\.devmanager\launch.cmd"
  exit /b
)

:: Write launch script into .devmanager/ (keeps temp files together for easy cleanup)
if not exist "!dir!\.devmanager" mkdir "!dir!\.devmanager"
set "tmpfile=!dir!\.devmanager\launch-single.ps1"
(
  echo $Host.UI.RawUI.WindowTitle = '!title!'
  echo claude --dangerously-skip-permissions '!cmd!'
) > "!tmpfile!"

:: Launch in a new Windows Terminal window (avoids splitting into dev server, etc.)
:: --suppressApplicationTitle prevents claude from overriding the tab name
start "" wt.exe -w new new-tab --title "!title!" --suppressApplicationTitle -d "!dir!" pwsh -NoLogo -NoExit -File "!tmpfile!"
