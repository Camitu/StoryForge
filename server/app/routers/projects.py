"""工程 CRUD（v3）。"""
import os
import re
import subprocess
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import store
from ..config import DEFAULT_STORAGE_ROOT
from ..models import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    """新建工程请求：name + storageDir（可选，项目存储父目录，默认 StoryForge/projects）。"""
    name: str
    storageDir: Optional[str] = None


def _safe_dirname(name: str) -> str:
    """把项目名清洗成合法的文件夹名（去掉 Windows 非法字符）。"""
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip().rstrip(". ")
    return cleaned or "未命名项目"


def _pick_directory() -> Optional[str]:
    """弹出 Windows 原生目录选择框，返回所选路径（取消返回 None）。

    用 PowerShell FolderBrowserDialog（独立进程，避免 tkinter 在线程中的问题）。
    """
    ps = r"""
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = '选择项目存储根目录（将自动创建项目名文件夹）'
$f.ShowNewFolderButton = $true
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}
"""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-STA", "-Command", ps],
            capture_output=True,
            text=True,
            timeout=600,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        path = result.stdout.strip()
        return path or None
    except Exception:
        return None


@router.get("")
def list_projects():
    return store.list_projects()


@router.post("/choose-directory")
def choose_directory():
    """弹出系统目录选择框，返回 {path}（用户取消时为 None）。"""
    return {"path": _pick_directory()}


@router.post("", status_code=201)
def create_project(body: ProjectCreate):
    parent = (body.storageDir or DEFAULT_STORAGE_ROOT).strip().rstrip("\\/")
    storage_dir = os.path.join(parent, _safe_dirname(body.name))
    project = Project(
        id=uuid.uuid4().hex,
        name=body.name,
        version="0.3.0",
        storageDir=storage_dir,
        worldview="",
        characters=[],
        scenes=[],
        chapterOrder=[],
        chapters=[],
        foreshadows=[],
    )
    return store.save_project(project)


@router.get("/{project_id}")
def get_project(project_id: str):
    try:
        return store.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(404, f"工程不存在: {project_id}")


@router.put("/{project_id}")
def update_project(project_id: str, project: Project):
    project.id = project_id
    return store.save_project(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str):
    if not store.delete_project(project_id):
        raise HTTPException(404, f"工程不存在: {project_id}")
