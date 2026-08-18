"""Pydantic 数据模型 —— 与 @storyforge/shared 的 TS 类型一一对应（v3）。

字段名使用 camelCase，保证 JSON 契约在 TS（编辑器）与 Python（服务）之间完全一致。
"""
from typing import Annotated, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

# 基础标量
EntityId = str
StoryDate = str


# ---------- 标准写作行 ----------
class ScriptLineBase(BaseModel):
    id: EntityId
    kind: Literal["dialogue", "narration", "scene"]


class DialogueLine(ScriptLineBase):
    kind: Literal["dialogue"] = "dialogue"
    characterId: EntityId
    characterName: Optional[str] = None
    expression: Optional[str] = None
    text: str
    sceneId: Optional[EntityId] = None
    sceneName: Optional[str] = None


class NarrationLine(ScriptLineBase):
    kind: Literal["narration"] = "narration"
    text: str
    sceneId: Optional[EntityId] = None
    sceneName: Optional[str] = None


class SceneLine(ScriptLineBase):
    kind: Literal["scene"] = "scene"
    sceneId: EntityId
    sceneName: Optional[str] = None


ScriptLine = Annotated[
    Union[DialogueLine, NarrationLine, SceneLine],
    Field(discriminator="kind"),
]


# ---------- 人设 ----------
class CharacterTimelinePoint(BaseModel):
    date: StoryDate
    content: str


class Character(BaseModel):
    id: EntityId
    name: str
    note: Optional[str] = None
    baseSetting: Optional[str] = None
    imagePath: Optional[str] = None
    plotTimeline: List[CharacterTimelinePoint] = []


# ---------- 场景 ----------
class Scene(BaseModel):
    id: EntityId
    name: str
    note: Optional[str] = None


# ---------- 伏笔 ----------
class LineRef(BaseModel):
    subChapterId: EntityId
    lineId: Optional[EntityId] = None


class Foreshadow(BaseModel):
    id: EntityId
    content: str
    plantedAt: LineRef
    plantedDate: Optional[str] = None
    status: Literal["open", "resolved"] = "open"
    resolvedAt: Optional[LineRef] = None
    resolvedDate: Optional[str] = None
    resolutionNote: Optional[str] = None


# ---------- 章节内片段 ----------
class ExternalBlock(BaseModel):
    id: EntityId
    type: str
    label: str
    afterLineIndex: int = 0


class SubFragment(BaseModel):
    id: EntityId
    name: str
    lines: List[ScriptLine] = []
    externalBlocks: List[ExternalBlock] = []
    freeText: str = ""


# ---------- 章节 ----------
class SubChapter(BaseModel):
    id: EntityId
    name: str
    date: StoryDate = ""
    summary: str = ""
    tags: List[str] = []
    condense: str = ""
    mode: Literal["standard", "free"] = "standard"
    freeText: str = ""
    lines: List[ScriptLine] = []
    externalBlocks: List[ExternalBlock] = []
    fragments: List[SubFragment] = []


class Chapter(BaseModel):
    id: EntityId
    name: str
    summary: Optional[str] = None
    subChapters: List[SubChapter] = []


# ---------- 工程 ----------
class Project(BaseModel):
    id: Optional[EntityId] = None
    name: str
    version: str = "0.3.0"
    storageDir: Optional[str] = None
    worldview: str = ""
    characters: List[Character] = []
    scenes: List[Scene] = []
    chapterOrder: List[EntityId] = []
    chapters: List[Chapter] = []
    foreshadows: List[Foreshadow] = []
    extra: Optional[Dict[str, object]] = None
