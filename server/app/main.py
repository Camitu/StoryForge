"""StoryForge Server 入口。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import ai, projects, sync

app = FastAPI(
    title="StoryForge",
    description="StoryForge 项目服务 / AI 协作 API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(ai.router)
app.include_router(sync.router)


@app.get("/")
def root():
    return {"service": "StoryForge", "docs": "/docs", "health": "ok"}
