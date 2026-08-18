"""StoryForge ↔ LetsGal 同步 API。

- POST /api/projects/{pid}/sync/bind  绑定 LetsGal 工程目录
- POST /api/projects/{pid}/sync/export  一键同步（StoryForge → LetsGal，增量）
- POST /api/projects/{pid}/sync/import  反向同步（LetsGal → StoryForge）
- GET  /api/projects/{pid}/sync/status  查看绑定与最近同步状态
"""
import json
import os
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import store
from ..config import DATA_DIR
from ..models import Project

# sync_bridge 模块路径（server/app/routers/sync.py → 上三级到项目根 → sync_bridge）
SYNC_BRIDGE_DIR = Path(__file__).resolve().parents[3] / "sync_bridge"
if str(SYNC_BRIDGE_DIR) not in sys.path:
    sys.path.insert(0, str(SYNC_BRIDGE_DIR))

from letsgal import LetsGalProject  # noqa: E402
from mapping import SyncMapping  # noqa: E402
from exporter import SyncExporter  # noqa: E402
from importer import SyncImporter  # noqa: E402

router = APIRouter(prefix="/api/projects/{project_id}/sync", tags=["sync"])


class BindRequest(BaseModel):
    letsgalDir: str


def _load(project_id: str):
    try:
        return store.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(404, f"工程不存在: {project_id}")


def _mapping(project_id: str) -> SyncMapping:
    return SyncMapping(project_id, DATA_DIR).load()


@router.post("/bind")
def bind_project(project_id: str, body: BindRequest):
    project = _load(project_id)
    lg_dir = body.letsgalDir.strip().strip('"').strip("'")
    if not lg_dir or not os.path.isdir(lg_dir):
        raise HTTPException(400, f"目录不存在: {lg_dir}")
    mapping = _mapping(project_id)
    mapping.letsgal_dir = lg_dir
    mapping.save()
    return {"ok": True, "projectId": project_id, "letsgalDir": lg_dir}


@router.post("/export")
def sync_export(project_id: str, dry_run: bool = True):
    project = _load(project_id)
    mapping = _mapping(project_id)
    if not mapping.letsgal_dir or not os.path.isdir(mapping.letsgal_dir):
        raise HTTPException(400, "未绑定 LetsGal 工程目录，请先调用 /sync/bind")
    sf_json = project.model_dump(exclude_none=True)
    exp = SyncExporter(sf_json, mapping.letsgal_dir, mapping, dry_run=dry_run)
    result = exp.execute()
    return result


@router.post("/import")
def sync_import(project_id: str, dry_run: bool = True):
    project = _load(project_id)
    mapping = _mapping(project_id)
    if not mapping.letsgal_dir or not os.path.isdir(mapping.letsgal_dir):
        raise HTTPException(400, "未绑定 LetsGal 工程目录，请先调用 /sync/bind")
    sf_json = project.model_dump(exclude_none=True)
    imp = SyncImporter(sf_json, mapping.letsgal_dir, mapping, dry_run=dry_run)
    result = imp.execute()
    if not dry_run:
        # 反向同步后的工程 JSON 已由 importer 原地修改（sf_json 与 result["project"] 同对象），
        # 重新验证并写回 StoryForge 存储
        updated_json = result["project"]
        updated_project = Project.model_validate(updated_json)
        store.save_project(updated_project)
    return result


@router.get("/status")
def sync_status(project_id: str):
    _load(project_id)
    mapping = _mapping(project_id)
    letsgal_dir = mapping.letsgal_dir if os.path.isdir(mapping.letsgal_dir) else ""
    if letsgal_dir:
        lg = LetsGalProject(letsgal_dir)
        lg.load()
        info = {
            "bound": True,
            "letsgalDir": letsgal_dir,
            "chapters": len(lg.chapters),
            "characters": len(lg.characters),
            "scenes": len(lg.scenes),
            "chapterNames": lg.chapter_order,
        }
    else:
        info = {"bound": False, "letsgalDir": ""}
    return info
