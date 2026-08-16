@echo off
rem ============================================================
rem  Nod 引擎打包 (PyInstaller onedir)
rem  输出: dist\nod-engine\  -> nod-engine.exe + _internal\
rem  注意: faster-whisper+ctranslate2 体积较大 (300-500MB)
rem        PyQt5 顶层 import 必须保留 (bridge 信号依赖), 不能 exclude
rem ============================================================
setlocal
cd /d "%~dp0"

rem 安装 PyInstaller (官方源)
if not exist .venv\Scripts\pyinstaller.exe (
  echo [1/3] installing PyInstaller...
  .venv\Scripts\python.exe -m pip install pyinstaller
)

echo [2/3] building nod-engine.exe (onedir)...
.venv\Scripts\pyinstaller.exe --noconfirm --clean ^
  --name nod-engine --onedir ^
  --collect-all faster_whisper --collect-all ctranslate2 ^
  --collect-all sounddevice --collect-all soundcard ^
  --exclude-module keyboard ^
  app.py
if errorlevel 1 ( echo BUILD FAILED & pause & exit /b 1 )

echo [3/3] copying customer config (开源版不内置 key, 用户首次运行填写)...
copy /y config.client.json dist\nod-engine\_internal\config.json >nul 2>&1
if exist secrets.client.json copy /y secrets.client.json dist\nod-engine\_internal\secrets.json >nul 2>&1
if not exist dist\nod-engine\_internal\config.json (
  echo config.json 未复制到 _internal\, 检查 --add-data
)

echo.
echo DONE: dist\nod-engine\nod-engine.exe
echo 下一步: desktop 目录 npx electron-builder --win 打安装包
pause
