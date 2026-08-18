@echo off
cd /d %~dp0
rem 防呆：8790 已被占用说明可能有多实例在跑（会并发写 project.json）
netstat -ano | findstr :8790 | findstr LISTENING >nul
if not errorlevel 1 (
  echo [错误] 8790 端口已被占用，可能存在多个 StoryForge Server 实例。
  echo 请先关闭旧实例再启动，避免并发写入工程文件导致损坏。
  pause
  exit /b 1
)
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8790
