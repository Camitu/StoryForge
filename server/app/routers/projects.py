"""工程 CRUD（v3）。"""
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import store
from ..models import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    """新建工程请求：name + storageDir（项目存储根目录）。"""
    name: str
    storageDir: Optional[str] = None


@router.get("")
def list_projects():
    return store.list_projects()


@router.post("", status_code=201)
def create_project(body: ProjectCreate):
    project = Project(
        id=uuid.uuid4().hex,
        name=body.name,
        version="0.3.0",
        storageDir=body.storageDir,
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
