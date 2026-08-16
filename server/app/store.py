"""JSON 工程文件存储（权威存储，git 友好）。"""
import json
import os
import re
from typing import List

from .config import DATA_DIR
from .models import Project


def _sanitize(project_id: str) -> str:
    s = str(project_id).strip()
    if not re.fullmatch(r"[A-Za-z0-9\-_]+", s):
        raise ValueError(f"非法 project id: {project_id}")
    return s


def _path(project_id: str) -> str:
    return os.path.join(DATA_DIR, f"{_sanitize(project_id)}.json")


def list_projects() -> List[dict]:
    out = []
    for name in sorted(os.listdir(DATA_DIR)):
        if name.endswith(".json"):
            pid = name[:-5]
            try:
                p = load_project(pid)
                out.append({"id": p.id, "name": p.name, "version": p.version})
            except Exception:
                continue
    return out


def load_project(project_id: str) -> Project:
    path = _path(project_id)
    if not os.path.exists(path):
        raise FileNotFoundError(f"工程不存在: {project_id}")
    with open(path, "r", encoding="utf-8") as f:
        return Project.model_validate(json.load(f))


def save_project(project: Project) -> Project:
    if not project.id:
        raise ValueError("project.id 不能为空")
    path = _path(project.id)
    with open(path, "w", encoding="utf-8") as f:
        f.write(project.model_dump_json(indent=2, exclude_none=True))
    return project


def delete_project(project_id: str) -> bool:
    path = _path(project_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False
