"""本地文件系统浏览 API（供前端全屏文件夹选择器用）。

仅用于浏览目录结构（不读文件内容），本地开发工具场景。
"""
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/fs", tags=["fs"])


@router.get("/drives")
def list_drives():
    """列出可用盘符（Windows）：["C:\\", "D:\\", ...]"""
    drives = []
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        root = f"{letter}:\\"
        if os.path.isdir(root):
            drives.append(root)
    return {"drives": drives}


@router.get("/list")
def list_dir(path: str = ""):
    """列出指定目录下的子目录。

    - path 为空 → 返回盘符列表（drives 字段）
    - path 为目录 → 返回 {path, parent, dirs}，dirs 为子目录名数组
    """
    if not path.strip():
        return {"path": "", "parent": None, "drives": list_drives()["drives"], "dirs": []}
    p = Path(path.strip())
    if not p.is_dir():
        raise HTTPException(400, f"不是目录: {path}")
    try:
        dirs = sorted(
            (d.name for d in p.iterdir() if d.is_dir()),
            key=str.lower,
        )
    except PermissionError:
        dirs = []
    parent = str(p.parent) if p.parent != p else None
    return {"path": str(p), "parent": parent, "drives": [], "dirs": dirs}
