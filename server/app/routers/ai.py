"""内容读写 API（v3）：供编辑器与 AI 调用。

覆盖：世界观、人设（含剧情设定）、场景、大章节/小章节、标准写作行、
自由写作、剧情浓缩、伏笔（登记/回收/列表）、全局搜索、一致性检查。

所有操作都是「读工程 → 修改 → 写回」，方便 AI 通过 API 直接驱动。
"""
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, TypeAdapter

from .. import logic, store
from ..models import Chapter, Character, Foreshadow, LineRef, Project, Scene, ScriptLine, SubChapter, SubFragment

router = APIRouter(prefix="/api/projects/{project_id}", tags=["writing"])

# ScriptLine 是判别联合，用 TypeAdapter 按 kind 构造
SCRIPT_LINE_ADAPTER = TypeAdapter(ScriptLine)


# ---------- 工具 ----------

def _load(project_id: str) -> Project:
    try:
        return store.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(404, f"工程不存在: {project_id}")


def _save(project: Project) -> Project:
    return store.save_project(project)


def _find_subchapter(project: Project, subchapter_id: str):
    """返回 (chapter, subchapter)。"""
    found = logic.get_subchapter(project, subchapter_id)
    if found is None:
        raise HTTPException(404, f"小章节不存在: {subchapter_id}")
    return found


def _project_dir(project: Project):
    """工程文件目录：storageDir 或默认 server/data/{id}/。"""
    import os
    from ..config import DATA_DIR
    if project.storageDir:
        return Path(project.storageDir)
    return Path(DATA_DIR) / (project.id or "unknown")


def _default_chapter(project: Project) -> Chapter:
    """没有大章节时自动创建默认大章节（插入在对应位置，这里插到末尾）。"""
    chapter = Chapter(id=uuid.uuid4().hex, name="默认", summary="", subChapters=[])
    project.chapters.append(chapter)
    project.chapterOrder.append(chapter.id)
    return chapter


def _find_or_create_chapter(project: Project, chapter_id: Optional[str]) -> Chapter:
    if chapter_id:
        ch = next((c for c in project.chapters if c.id == chapter_id), None)
        if ch:
            return ch
    return _default_chapter(project)


# ---------- 世界观 ----------

@router.get("/worldview")
def get_worldview(project_id: str):
    project = _load(project_id)
    return {"worldview": project.worldview}


@router.put("/worldview")
def put_worldview(project_id: str, body: dict):
    project = _load(project_id)
    project.worldview = body.get("worldview", "")
    _save(project)
    return {"worldview": project.worldview}


# ---------- 人设 ----------

class CharacterIn(BaseModel):
    name: str
    note: Optional[str] = None
    baseSetting: Optional[str] = None
    imagePath: Optional[str] = None
    plotTimeline: List[dict] = []


@router.get("/characters")
def list_characters(project_id: str):
    project = _load(project_id)
    return project.characters


@router.post("/characters", status_code=201)
def create_character(project_id: str, body: CharacterIn):
    project = _load(project_id)
    if any(c.name == body.name for c in project.characters):
        raise HTTPException(400, f"角色已存在: {body.name}")
    char = Character(id=uuid.uuid4().hex, **body.model_dump())
    project.characters.append(char)
    _save(project)
    return char


@router.put("/characters/{cid}")
def update_character(project_id: str, cid: str, body: CharacterIn):
    project = _load(project_id)
    char = next((c for c in project.characters if c.id == cid), None)
    if char is None:
        raise HTTPException(404, f"角色不存在: {cid}")
    char.name = body.name
    char.note = body.note
    char.baseSetting = body.baseSetting
    char.imagePath = body.imagePath
    char.plotTimeline = body.plotTimeline
    _save(project)
    return char


@router.delete("/characters/{cid}", status_code=204)
def delete_character(project_id: str, cid: str):
    project = _load(project_id)
    char = next((c for c in project.characters if c.id == cid), None)
    if char is None:
        raise HTTPException(404, f"角色不存在: {cid}")
    refs = logic.character_references(project, cid)
    if refs:
        raise HTTPException(409, f"角色被章节引用，无法删除: {refs[:5]}")
    project.characters = [c for c in project.characters if c.id != cid]
    _save(project)


@router.get("/characters/{cid}/refs")
def character_refs(project_id: str, cid: str):
    project = _load(project_id)
    return {"refs": logic.character_references(project, cid)}


# ---------- 场景 ----------

class SceneIn(BaseModel):
    name: str
    note: Optional[str] = None


@router.get("/scenes")
def list_scenes(project_id: str):
    project = _load(project_id)
    return project.scenes


@router.post("/scenes", status_code=201)
def create_scene(project_id: str, body: SceneIn):
    project = _load(project_id)
    if any(s.name == body.name for s in project.scenes):
        raise HTTPException(400, f"场景已存在: {body.name}")
    scene = Scene(id=uuid.uuid4().hex, **body.model_dump())
    project.scenes.append(scene)
    _save(project)
    return scene


@router.put("/scenes/{sid}")
def update_scene(project_id: str, sid: str, body: SceneIn):
    project = _load(project_id)
    scene = next((s for s in project.scenes if s.id == sid), None)
    if scene is None:
        raise HTTPException(404, f"场景不存在: {sid}")
    if any(s.name == body.name and s.id != sid for s in project.scenes):
        raise HTTPException(400, f"场景已存在: {body.name}")
    scene.name = body.name
    scene.note = body.note
    _save(project)
    return scene


@router.delete("/scenes/{sid}", status_code=204)
def delete_scene(project_id: str, sid: str):
    project = _load(project_id)
    scene = next((s for s in project.scenes if s.id == sid), None)
    if scene is None:
        raise HTTPException(404, f"场景不存在: {sid}")
    project.scenes = [s for s in project.scenes if s.id != sid]
    _save(project)


# ---------- 大章节 ----------

class ChapterIn(BaseModel):
    name: str
    summary: Optional[str] = None


@router.get("/chapters")
def list_chapters(project_id: str):
    project = _load(project_id)
    return project.chapters


@router.post("/chapters", status_code=201)
def create_chapter(project_id: str, body: ChapterIn):
    project = _load(project_id)
    chapter = Chapter(id=uuid.uuid4().hex, name=body.name, summary=body.summary, subChapters=[])
    project.chapters.append(chapter)
    project.chapterOrder.append(chapter.id)
    _save(project)
    return chapter


@router.put("/chapters/{cid}")
def update_chapter(project_id: str, cid: str, body: ChapterIn):
    project = _load(project_id)
    chapter = next((c for c in project.chapters if c.id == cid), None)
    if chapter is None:
        raise HTTPException(404, f"大章节不存在: {cid}")
    chapter.name = body.name
    chapter.summary = body.summary
    _save(project)
    return chapter


@router.delete("/chapters/{cid}", status_code=204)
def delete_chapter(project_id: str, cid: str):
    project = _load(project_id)
    chapter = next((c for c in project.chapters if c.id == cid), None)
    if chapter is None:
        raise HTTPException(404, f"大章节不存在: {cid}")
    if chapter.subChapters:
        raise HTTPException(409, "大章节下有小章节，请先移走或删除")
    project.chapters = [c for c in project.chapters if c.id != cid]
    project.chapterOrder = [x for x in project.chapterOrder if x != cid]
    _save(project)


@router.post("/chapters/{cid}/move")
def move_chapter(project_id: str, cid: str, body: dict):
    """调整大章节顺序：{delta: -1|1}"""
    project = _load(project_id)
    order = project.chapterOrder
    idx = order.index(cid) if cid in order else -1
    if idx < 0:
        raise HTTPException(404, f"大章节不存在: {cid}")
    new_idx = idx + int(body.get("delta", 0))
    if new_idx < 0 or new_idx >= len(order):
        raise HTTPException(400, "无法移动（已在边界）")
    order[idx], order[new_idx] = order[new_idx], order[idx]
    _save(project)
    return {"ok": True}


# ---------- 小章节 ----------

class SubChapterIn(BaseModel):
    name: str
    date: str = ""
    summary: str = ""
    tags: List[str] = []
    condense: str = ""
    mode: str = "standard"
    freeText: str = ""


@router.post("/chapters/{cid}/subchapters", status_code=201)
def create_subchapter(project_id: str, cid: str, body: SubChapterIn):
    project = _load(project_id)
    chapter = _find_or_create_chapter(project, cid)
    # 小章节名唯一（LetsGal 章节名）
    all_names = {sc.name for c in project.chapters for sc in c.subChapters}
    if body.name in all_names:
        raise HTTPException(400, f"小章节名已存在: {body.name}")
    sub = SubChapter(id=uuid.uuid4().hex, **body.model_dump(), lines=[])
    chapter.subChapters.append(sub)
    _save(project)
    return sub


@router.get("/subchapters/{sid}")
def get_subchapter(project_id: str, sid: str):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    return sub


@router.put("/subchapters/{sid}")
def update_subchapter(project_id: str, sid: str, body: SubChapterIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    # 名称唯一性检查（排除自己）
    all_names = {sc.name for c in project.chapters for sc in c.subChapters if sc.id != sid}
    if body.name in all_names:
        raise HTTPException(400, f"小章节名已存在: {body.name}")
    sub.name = body.name
    sub.date = body.date
    sub.summary = body.summary
    sub.tags = body.tags
    sub.condense = body.condense
    sub.mode = body.mode
    sub.freeText = body.freeText
    _save(project)
    return sub


@router.delete("/subchapters/{sid}", status_code=204)
def delete_subchapter(project_id: str, sid: str):
    project = _load(project_id)
    chapter, _sub = _find_subchapter(project, sid)
    chapter.subChapters = [s for s in chapter.subChapters if s.id != sid]
    _save(project)


@router.post("/subchapters/{sid}/move")
def move_subchapter(project_id: str, sid: str, body: dict):
    """调整小章节顺序：{delta: -1|1}，或移动到大章节：{chapterId: xxx}"""
    project = _load(project_id)
    chapter, sub = _find_subchapter(project, sid)
    if body.get("chapterId"):
        # 移动到另一个大章节
        target = _find_or_create_chapter(project, body["chapterId"])
        if target.id != chapter.id:
            chapter.subChapters = [s for s in chapter.subChapters if s.id != sid]
            target.subChapters.append(sub)
            _save(project)
        return {"ok": True}
    idx = next(i for i, s in enumerate(chapter.subChapters) if s.id == sid)
    new_idx = idx + int(body.get("delta", 0))
    if new_idx < 0 or new_idx >= len(chapter.subChapters):
        raise HTTPException(400, "无法移动（已在边界）")
    chapter.subChapters[idx], chapter.subChapters[new_idx] = chapter.subChapters[new_idx], chapter.subChapters[idx]
    _save(project)
    return {"ok": True}


# ---------- 标准写作行 ----------

class LineIn(BaseModel):
    kind: str
    characterId: Optional[str] = None
    characterName: Optional[str] = None
    expression: Optional[str] = None
    text: Optional[str] = None
    sceneId: Optional[str] = None
    sceneName: Optional[str] = None


@router.post("/subchapters/{sid}/lines", status_code=201)
def add_line(project_id: str, sid: str, body: LineIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    data = {"id": uuid.uuid4().hex, **body.model_dump(exclude_none=True)}
    line = SCRIPT_LINE_ADAPTER.validate_python(data)
    sub.lines.append(line)
    _save(project)
    return line


@router.put("/subchapters/{sid}/lines/{lid}")
def update_line(project_id: str, sid: str, lid: str, body: LineIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    line = next((l for l in sub.lines if l.id == lid), None)
    if line is None:
        raise HTTPException(404, f"行不存在: {lid}")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(line, k, v)
    _save(project)
    return line


@router.delete("/subchapters/{sid}/lines/{lid}", status_code=204)
def delete_line(project_id: str, sid: str, lid: str):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    sub.lines = [l for l in sub.lines if l.id != lid]
    _save(project)


@router.post("/subchapters/{sid}/lines/{lid}/move")
def move_line(project_id: str, sid: str, lid: str, body: dict):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    idx = next((i for i, l in enumerate(sub.lines) if l.id == lid), -1)
    if idx < 0:
        raise HTTPException(404, f"行不存在: {lid}")
    new_idx = idx + int(body.get("delta", 0))
    if new_idx < 0 or new_idx >= len(sub.lines):
        raise HTTPException(400, "无法移动（已在边界）")
    sub.lines[idx], sub.lines[new_idx] = sub.lines[new_idx], sub.lines[idx]
    _save(project)
    return {"ok": True}


# ---------- 章节内片段（子片段） ----------

class SubFragmentIn(BaseModel):
    name: Optional[str] = None
    freeText: Optional[str] = None


@router.post("/subchapters/{sid}/fragments", status_code=201)
def create_fragment(project_id: str, sid: str, body: SubFragmentIn):
    """在小章节下新建子片段（fragment）。"""
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    if not body.name or not body.name.strip():
        raise HTTPException(400, "子片段名不能为空")
    if any(f.name == body.name for f in sub.fragments):
        raise HTTPException(400, f"子片段已存在: {body.name}")
    frag = SubFragment(id=uuid.uuid4().hex, name=body.name, lines=[])
    sub.fragments.append(frag)
    _save(project)
    return frag


@router.put("/subchapters/{sid}/fragments/{fid}")
def update_fragment(project_id: str, sid: str, fid: str, body: SubFragmentIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    frag = next((f for f in sub.fragments if f.id == fid), None)
    if frag is None:
        raise HTTPException(404, f"子片段不存在: {fid}")
    if body.name is not None:
        frag.name = body.name
    if body.freeText is not None:
        frag.freeText = body.freeText
    _save(project)
    return frag


@router.delete("/subchapters/{sid}/fragments/{fid}", status_code=204)
def delete_fragment(project_id: str, sid: str, fid: str):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    sub.fragments = [f for f in sub.fragments if f.id != fid]
    _save(project)


@router.post("/subchapters/{sid}/fragments/{fid}/lines", status_code=201)
def add_fragment_line(project_id: str, sid: str, fid: str, body: LineIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    frag = next((f for f in sub.fragments if f.id == fid), None)
    if frag is None:
        raise HTTPException(404, f"子片段不存在: {fid}")
    data = {"id": uuid.uuid4().hex, **body.model_dump(exclude_none=True)}
    line = SCRIPT_LINE_ADAPTER.validate_python(data)
    frag.lines.append(line)
    _save(project)
    return line


@router.put("/subchapters/{sid}/fragments/{fid}/lines/{lid}")
def update_fragment_line(project_id: str, sid: str, fid: str, lid: str, body: LineIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    frag = next((f for f in sub.fragments if f.id == fid), None)
    if frag is None:
        raise HTTPException(404, f"子片段不存在: {fid}")
    line = next((l for l in frag.lines if l.id == lid), None)
    if line is None:
        raise HTTPException(404, f"行不存在: {lid}")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(line, k, v)
    _save(project)
    return line


@router.delete("/subchapters/{sid}/fragments/{fid}/lines/{lid}", status_code=204)
def delete_fragment_line(project_id: str, sid: str, fid: str, lid: str):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    frag = next((f for f in sub.fragments if f.id == fid), None)
    if frag is None:
        raise HTTPException(404, f"子片段不存在: {fid}")
    frag.lines = [l for l in frag.lines if l.id != lid]
    _save(project)


@router.post("/subchapters/{sid}/fragments/{fid}/lines/{lid}/move")
def move_fragment_line(project_id: str, sid: str, fid: str, lid: str, body: dict):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    frag = next((f for f in sub.fragments if f.id == fid), None)
    if frag is None:
        raise HTTPException(404, f"子片段不存在: {fid}")
    idx = next((i for i, l in enumerate(frag.lines) if l.id == lid), -1)
    if idx < 0:
        raise HTTPException(404, f"行不存在: {lid}")
    new_idx = idx + int(body.get("delta", 0))
    if new_idx < 0 or new_idx >= len(frag.lines):
        raise HTTPException(400, "无法移动（已在边界）")
    frag.lines[idx], frag.lines[new_idx] = frag.lines[new_idx], frag.lines[idx]
    _save(project)
    return {"ok": True}


# ---------- 伏笔 ----------

class ForeshadowIn(BaseModel):
    content: str
    subChapterId: str
    lineId: Optional[str] = None


class ResolveIn(BaseModel):
    subChapterId: str
    lineId: Optional[str] = None
    note: Optional[str] = None


@router.get("/foreshadows")
def list_foreshadows(project_id: str):
    project = _load(project_id)
    return project.foreshadows


@router.post("/foreshadows", status_code=201)
def register_foreshadow(project_id: str, body: ForeshadowIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, body.subChapterId)
    fs = Foreshadow(
        id=uuid.uuid4().hex,
        content=body.content,
        plantedAt=LineRef(subChapterId=body.subChapterId, lineId=body.lineId),
        plantedDate=sub.date,
        status="open",
    )
    project.foreshadows.append(fs)
    _save(project)
    return fs


@router.put("/foreshadows/{fid}")
def update_foreshadow(project_id: str, fid: str, body: dict):
    project = _load(project_id)
    fs = next((f for f in project.foreshadows if f.id == fid), None)
    if fs is None:
        raise HTTPException(404, f"伏笔不存在: {fid}")
    fs.content = body.get("content", fs.content)
    _save(project)
    return fs


@router.post("/foreshadows/{fid}/resolve")
def resolve_foreshadow(project_id: str, fid: str, body: ResolveIn):
    project = _load(project_id)
    fs = next((f for f in project.foreshadows if f.id == fid), None)
    if fs is None:
        raise HTTPException(404, f"伏笔不存在: {fid}")
    if fs.status == "resolved":
        raise HTTPException(409, f"伏笔已回收: {fid}")
    _chapter, sub = _find_subchapter(project, body.subChapterId)
    fs.status = "resolved"
    fs.resolvedAt = LineRef(subChapterId=body.subChapterId, lineId=body.lineId)
    fs.resolvedDate = sub.date
    fs.resolutionNote = body.note
    _save(project)
    return fs


@router.post("/foreshadows/{fid}/reopen")
def reopen_foreshadow(project_id: str, fid: str):
    project = _load(project_id)
    fs = next((f for f in project.foreshadows if f.id == fid), None)
    if fs is None:
        raise HTTPException(404, f"伏笔不存在: {fid}")
    fs.status = "open"
    fs.resolvedAt = None
    fs.resolvedDate = None
    fs.resolutionNote = None
    _save(project)
    return fs


@router.delete("/foreshadows/{fid}", status_code=204)
def delete_foreshadow(project_id: str, fid: str):
    project = _load(project_id)
    project.foreshadows = [f for f in project.foreshadows if f.id != fid]
    _save(project)


# ---------- 搜索 ----------

@router.get("/search")
def search(project_id: str, q: str = ""):
    """全局模糊搜索：匹配章节名、剧情概要、浓缩、对白/旁白文本、子片段文本、伏笔内容。"""
    project = _load(project_id)
    query = q.strip().lower()
    results = []
    if not query:
        return results
    for chapter in project.chapters:
        for sub in chapter.subChapters:
            hits = []
            fragment_id = None
            if query in sub.name.lower():
                hits.append(f"章节名: {sub.name}")
            if query in sub.summary.lower():
                hits.append("剧情概要")
            if query in sub.condense.lower():
                hits.append("剧情浓缩")
            for line in sub.lines:
                text = getattr(line, "text", "") or ""
                if query in text.lower():
                    preview = text[:60]
                    hits.append(f"台词: {preview}")
            # 子片段（fragment）内的行
            for frag in sub.fragments:
                for line in frag.lines:
                    text = getattr(line, "text", "") or ""
                    if query in text.lower():
                        preview = text[:60]
                        hits.append(f"片段「{frag.name}」台词: {preview}")
                        if fragment_id is None:
                            fragment_id = frag.id
            if hits:
                results.append({
                    "subChapterId": sub.id,
                    "chapterName": chapter.name,
                    "subChapterName": sub.name,
                    "date": sub.date,
                    "fragmentId": fragment_id,
                    "hits": hits[:5],
                })
    return results


# ---------- 一致性检查 ----------

@router.get("/check")
def check(project_id: str):
    project = _load(project_id)
    return logic.check_project(project)


# ---------- 图片上传 / 媒体读取 ----------

@router.post("/upload")
async def upload_image(project_id: str, file: UploadFile = File(...)):
    """上传图片到工程目录（storageDir/assets/images/），返回相对路径。

    把图片复制进工程目录，防止原文件被改名/移动后失效。
    """
    project = _load(project_id)
    import os
    import shutil

    base_dir = _project_dir(project)
    assets_dir = base_dir / "assets" / "images"
    assets_dir.mkdir(parents=True, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise HTTPException(400, f"不支持的图片格式: {ext}")
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = assets_dir / fname
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    rel = f"assets/images/{fname}"
    return {"path": rel}


@router.get("/media")
def get_media(project_id: str, path: str = ""):
    """读取工程目录下的文件（如图片），用于前端显示。"""
    project = _load(project_id)
    # 防目录穿越
    base = _project_dir(project).resolve()
    target = (base / path).resolve()
    if not str(target).startswith(str(base)) or not target.is_file():
        raise HTTPException(404, f"文件不存在: {path}")
    return FileResponse(target)
