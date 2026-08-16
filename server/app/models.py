"""Pydantic 数据模型 —— 与 @storyforge/shared 的 TS 类型一一对应。

字段名使用 camelCase，保证 JSON 契约在 TS（编辑器/运行时）与 Python（服务）之间完全一致。
"""
from typing import Annotated, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

# 基础标量
EntityId = str
StoryTime = str


class BeatBase(BaseModel):
    """所有 beat 共有的字段"""
    id: Optional[EntityId] = None


# ---------- beat ----------
class DialogueBeat(BeatBase):
    kind: Literal["dialogue"] = "dialogue"
    time: StoryTime
    characterId: EntityId
    expression: str = ""
    text: str
    sprite: Optional[str] = None
    avatar: Optional[str] = None
    sceneId: Optional[EntityId] = None
    cg: Optional[str] = None
    anchorId: Optional[EntityId] = None


class NarrationBeat(BeatBase):
    kind: Literal["narration"] = "narration"
    time: StoryTime
    text: str
    sceneId: Optional[EntityId] = None


class SceneBeat(BeatBase):
    kind: Literal["scene"] = "scene"
    time: StoryTime
    sceneId: EntityId
    transition: Optional[Literal["cut", "fade", "cover"]] = None
    durationMs: Optional[int] = None


class CharacterBeat(BeatBase):
    kind: Literal["character"] = "character"
    time: StoryTime
    characterId: EntityId
    op: Literal["show", "hide", "expression"]
    expression: Optional[str] = None
    sprite: Optional[str] = None
    position: Optional[str] = None


class BgmBeat(BeatBase):
    kind: Literal["bgm"] = "bgm"
    time: StoryTime
    op: Literal["play", "stop"]
    uri: Optional[str] = None
    loop: Optional[bool] = None
    volume: Optional[int] = None


class SfxBeat(BeatBase):
    kind: Literal["sfx"] = "sfx"
    time: StoryTime
    uri: str
    volume: Optional[int] = None


class ChoiceOption(BaseModel):
    text: str
    target: EntityId
    condition: Optional[str] = None


class ChoiceBeat(BeatBase):
    kind: Literal["choice"] = "choice"
    time: StoryTime
    options: List[ChoiceOption]


class JumpBeat(BeatBase):
    kind: Literal["jump"] = "jump"
    target: EntityId


class CurtainBeat(BeatBase):
    kind: Literal["curtain"] = "curtain"
    op: Literal["open", "close"]
    durationMs: Optional[int] = None
    color: Optional[str] = None


class EndBeat(BeatBase):
    kind: Literal["end"] = "end"
    endingId: Optional[EntityId] = None


Beat = Annotated[
    Union[
        DialogueBeat,
        NarrationBeat,
        SceneBeat,
        CharacterBeat,
        BgmBeat,
        SfxBeat,
        ChoiceBeat,
        JumpBeat,
        CurtainBeat,
        EndBeat,
    ],
    Field(discriminator="kind"),
]


class Anchor(BaseModel):
    id: EntityId
    beatId: EntityId
    kind: Literal["dialogue", "plot-point", "foreshadow", "ending"]
    note: Optional[str] = None


# ---------- character ----------
class AvatarCrop(BaseModel):
    x: float
    y: float
    w: float
    h: float


class ExpressionDef(BaseModel):
    name: str
    assetPath: str
    avatarCrop: Optional[AvatarCrop] = None


class Position(BaseModel):
    id: str
    name: str
    left: float
    top: float


class Character(BaseModel):
    id: EntityId
    name: str
    note: Optional[str] = None
    expressions: List[ExpressionDef] = []
    defaultPositionId: Optional[str] = None
    avatarCrop: Optional[AvatarCrop] = None
    attributeValues: Dict[str, Union[int, float, str, bool]] = {}
    themeColor: Optional[Dict[str, str]] = None


class CharacterState(BaseModel):
    characterId: EntityId
    relationStates: Dict[str, str] = {}
    traitState: Optional[str] = None
    attributeValues: Dict[str, Union[int, float, str, bool]] = {}
    sinceTime: Optional[str] = None


# ---------- scene ----------
class SceneLayer(BaseModel):
    id: EntityId
    name: str
    assetPath: str
    distance: float


class Scene(BaseModel):
    id: EntityId
    name: str
    layers: List[SceneLayer] = []


# ---------- foreshadow ----------
class BeatRef(BaseModel):
    chapterId: EntityId
    sectionId: EntityId
    beatId: Optional[EntityId] = None


class Foreshadow(BaseModel):
    id: EntityId
    content: str
    plantedAt: Optional[BeatRef] = None
    resolvedAt: Optional[BeatRef] = None
    status: Literal["open", "resolved"] = "open"
    resolutionNote: Optional[str] = None
    tags: List[str] = []


# ---------- state ----------
class WorldState(BaseModel):
    atTime: str
    characterStates: Dict[str, CharacterState] = {}
    flags: Dict[str, Union[str, int, float, bool]] = {}
    openForeshadows: List[Foreshadow] = []
    worldNotes: Optional[str] = None


class StateDelta(BaseModel):
    sectionId: EntityId
    characterStateChanges: Dict[str, CharacterState] = {}
    flagChanges: Dict[str, Union[str, int, float, bool]] = {}
    foreshadowsPlanted: List[Foreshadow] = []
    foreshadowsResolved: List[EntityId] = []
    summary: str
    keyPoints: List[str] = []
    tags: List[str] = []


# ---------- asset ----------
class AssetBinding(BaseModel):
    entityType: str
    entityId: EntityId
    role: str


class Asset(BaseModel):
    id: EntityId
    type: Literal["sprite", "avatar", "cg", "background", "bgm", "sfx", "ui"]
    path: str
    bindings: List[AssetBinding] = []
    refCount: Optional[int] = None
    ready: bool = False


# ---------- project ----------
class Resolution(BaseModel):
    width: int
    height: int


class Section(BaseModel):
    id: EntityId
    name: str
    time: StoryTime
    summary: str = ""
    condense: Optional[StateDelta] = None
    foreshadows: List[Foreshadow] = []
    anchors: List[Anchor] = []
    tags: List[str] = []
    beats: List[Beat] = []


class Chapter(BaseModel):
    id: EntityId
    name: str
    summary: Optional[str] = None
    sections: List[Section] = []


class Project(BaseModel):
    id: Optional[EntityId] = None
    name: str
    version: str = "0.1.0"
    resolution: Resolution = Resolution(width=1920, height=1080)
    chapterOrder: List[EntityId] = []
    chapters: List[Chapter] = []
    characters: List[Character] = []
    scenes: List[Scene] = []
    variables: Dict[str, Union[str, int, float, bool]] = {}
    assets: List[Asset] = []
