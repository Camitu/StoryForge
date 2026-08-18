@echo off
setlocal
cd /d %~dp0

rem ============================================================
rem   StoryForge 一键启动 / 停止
rem   用法：
rem     start-dev-windows.bat        启动（自动清理旧实例、自动开网页）
rem     start-dev-windows.bat stop   一键停止所有 StoryForge 服务
rem ============================================================

if /i "%~1"=="stop" goto :stop
if /i "%~1"=="-stop" goto :stop

echo ============================================
echo   StoryForge 一键启动
echo ============================================

rem 1. 强制清理旧实例（避免多个 uvicorn 并发写坏工程文件）
echo [1/4] 清理旧实例...
call :kill_port 8790 "StoryForge Server"
call :kill_port 5173 "StoryForge Editor"
timeout /t 1 /nobreak >nul

rem 2. 启动服务（独立窗口，便于查看日志）
echo [2/4] 启动 Server (:8790) 与 Editor (:5173)...
start "StoryForge Server :8790" cmd /k "cd /d %~dp0server && .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8790"
start "StoryForge Editor :5173" cmd /k "cd /d %~dp0editor && npm run dev -- --host 127.0.0.1 --port 5173"

rem 3. 等待服务就绪（最多 20 秒）
echo [3/4] 等待服务就绪...
set "READY="
for /l %%i in (1,1,20) do (
  curl -s -o nul http://127.0.0.1:8790/docs 2>nul && (
    curl -s -o nul http://127.0.0.1:5173 2>nul && set "READY=1" && goto :ready
  )
  timeout /t 1 /nobreak >nul
)
:ready
if defined READY (
  echo [4/4] 服务已就绪，打开编辑器...
) else (
  echo [警告] 服务未在预期时间内就绪，请检查上方窗口日志。
)
start "" http://127.0.0.1:5173
echo.
echo 已启动。停止服务请运行:  start-dev-windows.bat stop
echo.
exit /b 0

:stop
echo 正在关闭 StoryForge 服务...
call :kill_port 8790 "StoryForge Server"
call :kill_port 5173 "StoryForge Editor"
echo 已全部关闭。
exit /b 0

:kill_port
rem %1=端口 %2=服务名：查找占用进程并强制结束（netstat 第 5 列为 PID）
setlocal
set "PORT=%~1"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  echo   清理 %~2 旧实例 (PID %%a)
  taskkill /PID %%a /F >nul 2>&1
)
endlocal
exit /b 0
