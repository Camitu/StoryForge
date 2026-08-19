"""内容读写 API（v3）：供编辑器与 AI 调用。

覆盖：世界观、人设（含剧情设定）、场景、大章节/小章节、标准写作行、
自由写作、剧情浓缩、伏笔（登记/回收/列表）、全局搜索、一致性检查。

所有操作都是「读工程 → 修改 → 写回」，方便 AI 通过 API 直接驱动。
"""
import re
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


@router.get("/overview")
def project_overview(project_id: str):
    """项目概览（AI 友好）：一次调用获取世界观、角色名列表、场景名列表、章节树骨架、伏笔概要。

    供 AI 协作时快速了解项目全貌，再按需用明细接口取详情。
    """
    project = _load(project_id)
    return {
        "id": project.id,
        "name": project.name,
        "version": project.version,
        "worldview": project.worldview,
        "characters": [{"id": c.id, "name": c.name} for c in project.characters],
        "scenes": [{"id": s.id, "name": s.name} for s in project.scenes],
        "chapters": [
            {
                "id": ch.id,
                "name": ch.name,
                "summary": ch.summary,
                "subChapters": [
                    {
                        "id": sub.id,
                        "name": sub.name,
                        "date": sub.date,
                        "summary": sub.summary,
                        "tags": sub.tags,
                        "condense": sub.condense,
                        "mode": sub.mode,
                        "lineCount": len(sub.lines),
                        "fragmentNames": [f.name for f in sub.fragments],
                    }
                    for sub in ch.subChapters
                ],
            }
            for ch in project.chapters
        ],
        "foreshadows": [
            {
                "id": f.id,
                "content": f.content,
                "status": f.status,
                "plantedSubChapterId": f.plantedAt.subChapterId if f.plantedAt else None,
            }
            for f in project.foreshadows
        ],
    }


@router.get("/condense")
def get_condense(project_id: str):
    """浓缩剧情时间线（AI 友好，轻量）：按章节顺序返回各小章节的
    date/summary/condense/tags，不含正文行。

    超大项目（几十万字）下，AI 先读本接口即可掌握剧情走向与伏笔分布，
    再按需用 /subchapters/{sid} 取单章全文。
    """
    project = _load(project_id)
    order = project.chapterOrder or [c.id for c in project.chapters]
    chapters_out = []
    for cid in order:
        ch = next((c for c in project.chapters if c.id == cid), None)
        if ch is None:
            continue
        subs = []
        for sub in ch.subChapters:
            subs.append({
                "id": sub.id,
                "name": sub.name,
                "date": sub.date,
                "summary": sub.summary,
                "condense": sub.condense,
                "tags": sub.tags,
                "mode": sub.mode,
                "lineCount": len(sub.lines),
                "fragmentCount": len(sub.fragments),
            })
        chapters_out.append({"id": ch.id, "name": ch.name, "summary": ch.summary, "subChapters": subs})
    return {"chapters": chapters_out}

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


@router.get("/characters/{cid}")
def get_character(project_id: str, cid: str):
    """单个角色详情（含 name/note/baseSetting/plotTimeline）。"""
    project = _load(project_id)
    char = next((c for c in project.characters if c.id == cid), None)
    if char is None:
        raise HTTPException(404, f"角色不存在: {cid}")
    return char


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


@router.get("/characters/{cid}/expressions")
def list_character_expressions(project_id: str, cid: str):
    """该角色在全部剧情（含子片段）中已使用的表情差分统计。

    返回按使用次数降序的 [{expression, count}]，及 total。
    格式约定：表情可以是 `表情`（如 开心）或 `服装·表情`（如 衬衫·开心）。
    """
    project = _load(project_id)
    char = next((c for c in project.characters if c.id == cid), None)
    if char is None:
        raise HTTPException(404, f"角色不存在: {cid}")
    counts: dict[str, int] = {}

    def walk(lines):
        for l in lines:
            if l.kind == "dialogue" and l.characterId == cid and l.expression:
                counts[l.expression] = counts.get(l.expression, 0) + 1

    for ch in project.chapters:
        for sub in ch.subChapters:
            walk(sub.lines)
            for frag in sub.fragments:
                walk(frag.lines)
    items = [{"expression": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: (-x[1], x[0]))]
    return {"characterId": cid, "characterName": char.name, "expressions": items, "total": sum(counts.values())}


@router.post("/characters/{cid}/expressions/replace")
def replace_character_expression(project_id: str, cid: str, body: dict):
    """批量替换该角色在全部剧情（含子片段）中的某个表情为另一个表情。

    body: {"from": "旧表情", "to": "新表情"}（to 传空串 = 清除表情）。
    返回 {"replaced": 替换行数}。
    """
    project = _load(project_id)
    char = next((c for c in project.characters if c.id == cid), None)
    if char is None:
        raise HTTPException(404, f"角色不存在: {cid}")
    from_expr = (body.get("from") or "").strip()
    to_expr = (body.get("to") or "").strip()
    if not from_expr:
        raise HTTPException(400, "from 不能为空")
    replaced = 0

    def walk(lines):
        nonlocal replaced
        for l in lines:
            if l.kind == "dialogue" and l.characterId == cid and (l.expression or "") == from_expr:
                l.expression = to_expr or None
                replaced += 1

    for ch in project.chapters:
        for sub in ch.subChapters:
            walk(sub.lines)
            for frag in sub.fragments:
                walk(frag.lines)
    _save(project)
    return {"characterId": cid, "characterName": char.name, "from": from_expr, "to": to_expr or None, "replaced": replaced}


# ---------- 场景 ----------

class SceneIn(BaseModel):
    name: str
    note: Optional[str] = None
    imagePath: Optional[str] = None


@router.get("/scenes")
def list_scenes(project_id: str):
    project = _load(project_id)
    return project.scenes


@router.get("/scenes/{sid}")
def get_scene(project_id: str, sid: str):
    """单个场景详情（含 name/note）。"""
    project = _load(project_id)
    scene = next((s for s in project.scenes if s.id == sid), None)
    if scene is None:
        raise HTTPException(404, f"场景不存在: {sid}")
    return scene


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
    scene.imagePath = body.imagePath
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


# ---------- 自由写作 → 标准写作转换 ----------

FREE_TO_STANDARD_PROMPT = """你是剧本结构化助手。请把下面的自由写作草稿转换为标准写作行 JSON 数组，规则：
- 场景切换 → {"kind":"scene","sceneId":"<场景id>","sceneName":"<场景名>"}
- 对白 → {"kind":"dialogue","characterId":"<角色id>","characterName":"<角色名>","expression":"<表情>","text":"台词"}
- 旁白/描述 → {"kind":"narration","text":"..."}
- 必须使用提供的角色/场景 id；草稿中出现的角色/场景若不在列表里，characterId/sceneId 填 "__new__" 并保持名称
- 输出纯 JSON 数组，不要额外解释

可用角色: {characters}
可用场景: {scenes}
草稿:
{free_text}
"""


def _convert_free_text(free_text: str, project: Project, apply: bool):
    """把自由写作 Markdown 文本转成标准行 dict 列表（启发式解析）。

    规则：
    - `# 场景名` 标题行 → scene 行
    - `角色名（表情）：台词` / `角色名：台词` → dialogue 行
    - 其余行按空行分段合并为 narration 行
    角色/场景不存在时：apply=True 自动创建并落库；否则以 "__new__" 占位并记录。
    返回 (lines, created_char_names, created_scene_names)
    """
    lines: List[dict] = []
    created_chars: List[str] = []
    created_scenes: List[str] = []

    char_by_name = {c.name: c for c in project.characters}
    scene_by_name = {s.name: s for s in project.scenes}

    def get_char(name: str):
        name = name.strip()
        if name in char_by_name:
            return char_by_name[name]
        if apply:
            ch = Character(id=uuid.uuid4().hex, name=name, note="由自由写作转换自动创建")
            project.characters.append(ch)
            char_by_name[name] = ch
            created_chars.append(name)
            return ch
        created_chars.append(name)
        return None  # 预览模式：占位

    def get_scene(name: str):
        name = name.strip()
        if name in scene_by_name:
            return scene_by_name[name]
        if apply:
            sc = Scene(id=uuid.uuid4().hex, name=name, note="由自由写作转换自动创建")
            project.scenes.append(sc)
            scene_by_name[name] = sc
            created_scenes.append(name)
            return sc
        created_scenes.append(name)
        return None  # 预览模式：占位

    narration_buf: List[str] = []

    def flush_narration():
        nonlocal narration_buf
        if narration_buf:
            text = "\n".join(narration_buf).strip()
            if text:
                lines.append({"kind": "narration", "text": text})
            narration_buf = []

    DIALOG_RE = re.compile(r"^\s*(.+?)[（(]([^）)]*)[）)]\s*[：:]\s*(.+)$")  # 角色（表情）：台词
    DIALOG_RE2 = re.compile(r"^\s*(.+?)[：:]\s*(.+)$")  # 角色：台词
    SCENE_RE = re.compile(r"^\s*#{1,6}\s*(.+)$")  # # 场景名

    for raw in free_text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            flush_narration()
            continue
        m = SCENE_RE.match(line)
        if m:
            flush_narration()
            scene = get_scene(m.group(1).strip())
            lines.append({
                "kind": "scene",
                "sceneId": scene.id if scene else "__new__",
                "sceneName": m.group(1).strip(),
            })
            continue
        m = DIALOG_RE.match(line)
        if m:
            flush_narration()
            char = get_char(m.group(1))
            lines.append({
                "kind": "dialogue",
                "characterId": char.id if char else "__new__",
                "characterName": m.group(1).strip(),
                "expression": m.group(2).strip() or None,
                "text": m.group(3).strip(),
            })
            continue
        m = DIALOG_RE2.match(line)
        if m:
            flush_narration()
            char = get_char(m.group(1))
            lines.append({
                "kind": "dialogue",
                "characterId": char.id if char else "__new__",
                "characterName": m.group(1).strip(),
                "expression": None,
                "text": m.group(2).strip(),
            })
            continue
        narration_buf.append(line.strip())
    flush_narration()
    return lines, created_chars, created_scenes


@router.post("/subchapters/{sid}/convert-to-standard")
def convert_free_to_standard(project_id: str, sid: str, body: dict | None = None):
    """把该小章节的 freeText（自由写作草稿）转换为标准写作行。

    body: {"apply": bool} —— 默认 false 仅预览（不写库，不创建角色/场景）；
    apply=true 时写入 lines、自动创建缺失角色/场景、mode 置为 standard。
    同时返回 AI 精修用的提示词模板。
    """
    apply = bool((body or {}).get("apply", False))
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    if not sub.freeText.strip():
        raise HTTPException(400, f"小章节「{sub.name}」没有自由写作内容（freeText 为空）")
    lines, created_chars, created_scenes = _convert_free_text(sub.freeText, project, apply=apply)
    if apply:
        sub.lines = [SCRIPT_LINE_ADAPTER.validate_python({"id": uuid.uuid4().hex, **l}) for l in lines]
        sub.mode = "standard"
        _save(project)
    prompt = (FREE_TO_STANDARD_PROMPT
              .replace("{characters}", ", ".join(f"{c.name}={c.id}" for c in project.characters) or "（无）")
              .replace("{scenes}", ", ".join(f"{s.name}={s.id}" for s in project.scenes) or "（无）")
              .replace("{free_text}", sub.freeText[:4000]))
    return {
        "lines": lines,
        "createdCharacters": created_chars,
        "createdScenes": created_scenes,
        "applied": apply,
        "mode": sub.mode,
        "promptTemplate": prompt,
    }


# ---------- 标准写作行 ----------

class LineIn(BaseModel):
    kind: str
    characterId: Optional[str] = None
    characterName: Optional[str] = None
    expression: Optional[str] = None
    text: Optional[str] = None
    sceneId: Optional[str] = None
    sceneName: Optional[str] = None
    # 仅新建行使用：插入到该行 id 之后（编辑器 Enter 续行；缺省追加末尾）
    afterId: Optional[str] = None


def _insert_line(lines: list, line, after_id: Optional[str]) -> None:
    """把新行插入到 after_id 行之后；after_id 不存在或为空则追加末尾。"""
    if after_id:
        idx = next((i for i, l in enumerate(lines) if l.id == after_id), -1)
        if idx >= 0:
            lines.insert(idx + 1, line)
            return
    lines.append(line)


@router.post("/subchapters/{sid}/lines", status_code=201)
def add_line(project_id: str, sid: str, body: LineIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    data = {"id": uuid.uuid4().hex, **body.model_dump(exclude_none=True, exclude={"afterId"})}
    line = SCRIPT_LINE_ADAPTER.validate_python(data)
    _insert_line(sub.lines, line, body.afterId)
    _save(project)
    return line


@router.put("/subchapters/{sid}/lines/{lid}")
def update_line(project_id: str, sid: str, lid: str, body: LineIn):
    project = _load(project_id)
    _chapter, sub = _find_subchapter(project, sid)
    line = next((l for l in sub.lines if l.id == lid), None)
    if line is None:
        raise HTTPException(404, f"行不存在: {lid}")
    for k, v in body.model_dump(exclude_none=True, exclude={"afterId"}).items():
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
    data = {"id": uuid.uuid4().hex, **body.model_dump(exclude_none=True, exclude={"afterId"})}
    line = SCRIPT_LINE_ADAPTER.validate_python(data)
    _insert_line(frag.lines, line, body.afterId)
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
    for k, v in body.model_dump(exclude_none=True, exclude={"afterId"}).items():
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
    """全局模糊搜索：匹配章节名、剧情概要、浓缩、对白/旁白文本、子片段文本、伏笔内容，
    以及世界观、角色设定（name/note/baseSetting）、场景（name/note）。
    返回结果带 scope：chapter（可跳转章节）/ worldview / character / scene / foreshadow。"""
    project = _load(project_id)
    query = q.strip().lower()
    results = []
    if not query:
        return results

    # 世界观
    if query in project.worldview.lower():
        results.append({
            "scope": "worldview",
            "subChapterId": None,
            "chapterName": "世界观",
            "subChapterName": "整体世界观",
            "date": "",
            "fragmentId": None,
            "hits": [f"世界观: {project.worldview[:60]}"],
        })

    # 角色
    for c in project.characters:
        hits = []
        if query in c.name.lower():
            hits.append(f"角色名: {c.name}")
        if c.note and query in c.note.lower():
            hits.append(f"备注: {c.note[:60]}")
        if c.baseSetting and query in c.baseSetting.lower():
            hits.append(f"设定: {c.baseSetting[:60]}")
        if hits:
            results.append({
                "scope": "character",
                "subChapterId": None,
                "chapterName": "角色",
                "subChapterName": c.name,
                "date": "",
                "fragmentId": None,
                "hits": hits[:5],
            })

    # 场景
    for sc in project.scenes:
        hits = []
        if query in sc.name.lower():
            hits.append(f"场景名: {sc.name}")
        if sc.note and query in sc.note.lower():
            hits.append(f"场景说明: {sc.note[:60]}")
        if hits:
            results.append({
                "scope": "scene",
                "subChapterId": None,
                "chapterName": "场景",
                "subChapterName": sc.name,
                "date": "",
                "fragmentId": None,
                "hits": hits[:5],
            })

    # 伏笔
    for f in project.foreshadows:
        hits = []
        if query in f.content.lower():
            hits.append(f"伏笔: {f.content[:60]}")
        if f.resolutionNote and query in f.resolutionNote.lower():
            hits.append(f"回收说明: {f.resolutionNote[:60]}")
        if hits:
            results.append({
                "scope": "foreshadow",
                "subChapterId": f.plantedAt.subChapterId if f.plantedAt else None,
                "chapterName": "伏笔",
                "subChapterName": f.content[:20],
                "date": "",
                "fragmentId": None,
                "hits": hits[:5],
            })

    # 章节正文
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
                    "scope": "chapter",
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
