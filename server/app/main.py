"""StoryForge Server 入口。"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import BACKGROUND_DIR, SPRITE_DIR
from .routers import ai, projects

app = FastAPI(
    title="StoryForge",
    description="StoryForge 项目服务 / AI 协作 API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(ai.router)

# 静态媒体挂载（外部真实素材目录，不存在则跳过）
if os.path.isdir(SPRITE_DIR):
    app.mount("/media/sprites", StaticFiles(directory=SPRITE_DIR), name="sprites")
if os.path.isdir(BACKGROUND_DIR):
    app.mount("/media/backgrounds", StaticFiles(directory=BACKGROUND_DIR), name="backgrounds")


@app.get("/")
def root():
    return {"service": "StoryForge", "docs": "/docs", "health": "ok"}
