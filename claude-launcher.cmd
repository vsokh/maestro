@echo off
setlocal enabledelayedexpansion

:: Claude Code launcher — called by claudecode:// protocol handler
:: URL format: claudecode:<path>?<command>
:: Example:    claudecode:C:/Users/vsoko/Projects/therapy-desk?/orchestrator task 14

set "raw=%~1"

:: Strip protocol prefix
set "raw=!raw:claudecode:=!"

:: Remove leading slashes (browsers may add them)
:strip
if "!raw:~0,1!"=="/" set "raw=!raw:~1!" & goto strip

:: Split on ? — path is before, command is after
set "dir="
set "cmd="
for /f "tokens=1,* delims=?" %%a in ("!raw!") do (
  set "dir=%%a"
  set "cmd=%%b"
)

:: Convert forward slashes to backslashes in path
set "dir=!dir:/=\!"

:: URL-decode spaces
set "dir=!dir:%%20= !"
if defined cmd set "cmd=!cmd:%%20= !"
if defined cmd set "cmd=!cmd:+= !"

:: Default command if none provided
if not defined cmd set "cmd=/orchestrator next"

:: Launch Windows Terminal with Claude Code
start "" wt.exe -d "!dir!" cmd /k claude "!cmd!"
