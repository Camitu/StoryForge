"""AI 协作 API：上下文快照 / beat 提交（锚点保护）/ 浓缩 / 伏笔 / 一致性检查。

语义生成（写剧情、生成浓缩、语义查错）由外部 AI Agent 完成；本服务负责数据层 + 机械校验。
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import logic, store
from ..models import Beat, BeatRef, Foreshadow, Project, StateDelta

router = APIRouter(prefix="/api/projects/{project_id}", tags=["ai"])


def _get_project(project_id: str) -> Project:
    try:
        return store.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(404, f"工程不存在: {project_id}")


def _find_section(project: Project, section_id: str):
    for chapter in project.chapters:
        for sub in chapter.subChapters:
            for section in sub.sections:
                if section.id == section_id:
                    return chapter, section
    raise HTTPException(404, f"小节不存在: {section_id}")


@router.get("/context")
def get_context(project_id: str, at: Optional[str] = None):
    project = _get_project(project_id)
    return logic.compute_context(project, at)


@router.post("/sections/{section_id}/beats")
def submit_beats(project_id: str, section_id: str, beats: List[Beat], mode: str = "append"):
    """提交 / 改写 beat。锚点保护：锚点 beat 拒绝被修改或删除。

    mode: append（追加）| replace（整体替换，锚点 beat 强制保留）
    """
    project = _get_project(project_id)
    _chapter, section = _find_section(project, section_id)
    anchor_ids = {a.beatId for a in section.anchors}

    if mode == "append":
        for b in beats:
            if getattr(b, "id", None) and b.id in anchor_ids:
                raise HTTPException(409, f"锚点 beat 不可修改: {b.id}")
        section.beats.extend(beats)
    elif mode == "replace":
        anchored = [b for b in section.beats if getattr(b, "id", None) in anchor_ids]
        for b in beats:
            if getattr(b, "id", None) and b.id in anchor_ids:
                raise HTTPException(409, f"锚点 beat 不可修改: {b.id}")
        section.beats = anchored + beats
    else:
        raise HTTPException(400, "mode 仅支持 append 或 replace")

    store.save_project(project)
    return {"section_id": section_id, "beat_count": len(section.beats)}


@router.post("/sections/{section_id}/condense")
def submit_condense(project_id: str, section_id: str, delta: StateDelta):
    project = _get_project(project_id)
    _chapter, section = _find_section(project, section_id)
    delta.sectionId = section_id
    section.condense = delta
    store.save_project(project)
    return delta


class ForeshadowIn(BaseModel):
    content: str
    tags: List[str] = []
    beatId: Optional[str] = None


class ResolveIn(BaseModel):
    note: Optional[str] = None
    beatId: Optional[str] = None


@router.post("/sections/{section_id}/foreshadow", status_code=201)
def register_foreshadow(project_id: str, section_id: str, body: ForeshadowIn):
    project = _get_project(project_id)
    chapter, section = _find_section(project, section_id)
    fs = Foreshadow(
        id=uuid.uuid4().hex,
        content=body.content,
        plantedAt=BeatRef(chapterId=chapter.id, sectionId=section.id, beatId=body.beatId),
        resolvedAt=None,
        status="open",
        tags=body.tags,
    )
    section.foreshadows.append(fs)
    store.save_project(project)
    return fs


@router.post("/sections/{section_id}/foreshadow/{fid}/resolve")
def resolve_foreshadow(project_id: str, section_id: str, fid: str, body: ResolveIn):
    project = _get_project(project_id)
    chapter, section = _find_section(project, section_id)
    for fs in section.foreshadows:
        if fs.id == fid:
            if fs.status == "resolved":
                raise HTTPException(409, f"伏笔已回收: {fid}")
            fs.status = "resolved"
            fs.resolvedAt = BeatRef(chapterId=chapter.id, sectionId=section.id, beatId=body.beatId)
            fs.resolutionNote = body.note
            store.save_project(project)
            return fs
    raise HTTPException(404, f"伏笔不存在: {fid}")


@router.get("/check")
def check(project_id: str):
    project = _get_project(project_id)
    return logic.check_project(project)
