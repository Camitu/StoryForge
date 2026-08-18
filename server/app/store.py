"""JSON 工程文件存储（v3）。

存储策略：
- 每个工程在 `server/data/projects.json` 索引中登记 {id, name, storageDir}。
- 工程文件保存在用户选择的 storageDir 下 `project.json`。
- 若无 storageDir（旧工程/默认），则存 `server/data/{id}.json`。
"""
import json
import msvcrt
import os
import shutil
from pathlib import Path
from typing import List, Optional

from .config import DATA_DIR
from .models import Project

INDEX_PATH = Path(DATA_DIR) / "projects.json"


def _ensure_index() -> None:
    if not INDEX_PATH.exists():
        INDEX_PATH.write_text(json.dumps({"projects": []}, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_index() -> List[dict]:
    _ensure_index()
    try:
        return json.loads(INDEX_PATH.read_text(encoding="utf-8")).get("projects", [])
    except (json.JSONDecodeError, OSError):
        return []


def _atomic_write_text(path: Path, text: str) -> None:
    """原子写入：跨进程文件锁 + 临时文件 + os.replace，防并发/中断导致文件损坏。

    - msvcrt.locking：Windows 跨进程锁（同一时刻只有一个写入者）。
    - 写同目录 tmp 文件再 os.replace：替换原子，不会出现半截/拼接文件。
    """
    lock_path = path.with_suffix(path.suffix + ".lock")
    locked = False
    with open(lock_path, "a+b") as lf:
        try:
            if lf.seek(0, os.SEEK_END) == 0:
                lf.write(b"\0")
                lf.flush()
            msvcrt.locking(lf.fileno(), msvcrt.LK_LOCK, 1)
            locked = True
        except OSError:
            locked = False  # 锁获取失败（如超时）→ 降级为仅原子写
        try:
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, path)
        finally:
            if locked:
                try:
                    lf.seek(0)
                    msvcrt.locking(lf.fileno(), msvcrt.LK_UNLCK, 1)
                except OSError:
                    pass


def _save_index(projects: List[dict]) -> None:
    _atomic_write_text(INDEX_PATH, json.dumps({"projects": projects}, ensure_ascii=False, indent=2))


def _project_path(project: Project) -> Path:
    """返回工程文件路径：优先 storageDir/project.json，否则 data/{id}.json。"""
    if project.storageDir:
        return Path(project.storageDir) / "project.json"
    return Path(DATA_DIR) / f"{project.id}.json"


def list_projects() -> List[dict]:
    """列出所有工程（含 storageDir）。"""
    out = []
    for entry in _load_index():
        pid = entry.get("id")
        try:
            p = load_project(pid)
            out.append({"id": p.id, "name": p.name, "version": p.version, "storageDir": p.storageDir})
        except Exception:
            continue
    return out


def load_project(project_id: str) -> Project:
    """按 id 读取工程。"""
    entry = next((e for e in _load_index() if e.get("id") == project_id), None)
    if entry:
        path = Path(entry["storageDir"]) / "project.json" if entry.get("storageDir") else Path(DATA_DIR) / f"{project_id}.json"
    else:
        path = Path(DATA_DIR) / f"{project_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"工程不存在: {project_id}")
    with open(path, "r", encoding="utf-8") as f:
        return Project.model_validate(json.load(f))


def save_project(project: Project) -> Project:
    """保存工程：登记索引（若新工程），写入工程文件。"""
    if not project.id:
        raise ValueError("project.id 不能为空")
    index = _load_index()
    entry = next((e for e in index if e.get("id") == project.id), None)
    if entry is None:
        index.append({"id": project.id, "name": project.name, "storageDir": project.storageDir})
        _save_index(index)
    else:
        entry["name"] = project.name
        entry["storageDir"] = project.storageDir
        _save_index(index)
    path = _project_path(project)
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write_text(path, project.model_dump_json(indent=2, exclude_none=True))
    return project


def delete_project(project_id: str) -> bool:
    """删除工程（索引 + 本地文件）。

    若工程有 storageDir，删除整个目录（project.json + assets 等）；
    否则只删 data/{id}.json。不影响 LetsGal 项目。
    """
    index = _load_index()
    entry = next((e for e in index if e.get("id") == project_id), None)
    if entry is None:
        return False
    index = [e for e in index if e.get("id") != project_id]
    _save_index(index)
    if entry.get("storageDir"):
        dir_path = Path(entry["storageDir"])
        if dir_path.is_dir():
            shutil.rmtree(dir_path, ignore_errors=True)
    else:
        path = Path(DATA_DIR) / f"{project_id}.json"
        if path.exists():
            os.remove(path)
    # 清理同步映射文件
    sync_path = Path(DATA_DIR) / f"{project_id}.sync.json"
    if sync_path.exists():
        os.remove(sync_path)
    return True
