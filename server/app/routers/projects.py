"""工程 CRUD。"""
import uuid

from fastapi import APIRouter, HTTPException

from .. import store
from ..models import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects():
    return store.list_projects()


@router.post("", status_code=201)
def create_project(project: Project):
    if not project.id:
        project.id = uuid.uuid4().hex
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
