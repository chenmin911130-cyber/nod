@echo off
rem Nod 启动脚本 (双击运行)
rem Electron 主进程负责拉起 Python 引擎 (.venv app.py --bridge)
set PYTHONPATH=
cd /d "%~dp0"
cd desktop
call npm start
if errorlevel 1 pause
