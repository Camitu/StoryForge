"""StoryForge → LetsGal Sync Bridge

只读解析器：读取 LetsGal 工程目录，提取角色/场景/章节/manifest 结构，
用于验证我们对 LetsGal 格式的理解，以及后续导出器的符号对齐。

用法（示例）：
    from letsgal import LetsGalProject
    proj = LetsGalProject(r"E:\\GamePro\\LetsGal 恋爱游戏进行时 序章-15e8c8")
    proj.load()
    print(proj.chapter_order)
"""
from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------- 数据类（只读视图） ----------

@dataclass
class Expression:
    name: str
    asset_path: str
    avatar_crop: Optional[Dict[str, float]] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LetsCharacter:
    id: str
    name: str
    expressions: List[Expression] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SceneLayer:
    id: str
    name: str
    asset_path: str
    distance: float


@dataclass
class LetsScene:
    id: str
    name: str
    layers: List[SceneLayer] = field(default_factory=list)


@dataclass
class Block:
    id: str
    type: str
    props: Dict[str, Any]
    content: Optional[List[Dict[str, Any]]] = None


@dataclass
class Fragment:
    id: str
    name: str
    blocks: List[Block] = field(default_factory=list)


@dataclass
class Chapter:
    id: str
    name: str
    fragments: List[Fragment] = field(default_factory=list)


@dataclass
class ManifestEntry:
    asset_id: str
    path: str
    size: Optional[int] = None
    updated_at: Optional[int] = None
    legacy_paths: List[str] = field(default_factory=list)


class LetsGalProject:
    """LetsGal 工程只读解析器。"""

    def __init__(self, root: str | os.PathLike):
        self.root = Path(root)
        self.project: Dict[str, Any] = {}
        self.characters: Dict[str, LetsCharacter] = {}
        self.scenes: Dict[str, LetsScene] = {}
        self.chapters: Dict[str, Chapter] = {}
        self.chapter_order: List[str] = []
        self.manifest: Dict[str, ManifestEntry] = {}

    # ---------- 加载 ----------
    def load(self) -> "LetsGalProject":
        self.project = self._read_json(self.root / "project.json") or {}
        self.chapter_order = self.project.get("chapterOrder", [])

        chars = self._read_json(self.root / "characters.json") or {}
        for c in chars.get("characters", []):
            expressions = [
                Expression(
                    name=e.get("name", ""),
                    asset_path=e.get("assetPath", ""),
                    avatar_crop=e.get("avatarCrop"),
                    extra={k: v for k, v in e.items() if k not in ("name", "assetPath", "avatarCrop")},
                )
                for e in c.get("expressions", [])
            ]
            self.characters[c.get("id", "")] = LetsCharacter(
                id=c.get("id", ""),
                name=c.get("name", ""),
                expressions=expressions,
                extra={k: v for k, v in c.items() if k not in ("id", "name", "expressions")},
            )

        scenes = self._read_json(self.root / "scenes.json") or {}
        for s in scenes.get("scenes", []):
            layers = [
                SceneLayer(
                    id=l.get("id", ""),
                    name=l.get("name", ""),
                    asset_path=l.get("assetPath", ""),
                    distance=l.get("distance", 0),
                )
                for l in s.get("layers", [])
            ]
            self.scenes[s.get("id", "")] = LetsScene(id=s.get("id", ""), name=s.get("name", ""), layers=layers)

        chapters_dir = self.root / "chapters"
        if chapters_dir.is_dir():
            for p in sorted(chapters_dir.glob("*.json")):
                ch = self._read_json(p)
                if not ch:
                    continue
                fragments = []
                for f in ch.get("fragments", []):
                    blocks = [
                        Block(
                            id=b.get("id", ""),
                            type=b.get("type", ""),
                            props=b.get("props", {}),
                            content=b.get("content"),
                        )
                        for b in f.get("blocks", [])
                    ]
                    fragments.append(Fragment(id=f.get("id", ""), name=f.get("name", ""), blocks=blocks))
                self.chapters[ch.get("id", p.stem)] = Chapter(
                    id=ch.get("id", p.stem), name=ch.get("name", p.stem), fragments=fragments
                )

        manifest = self._read_json(self.root / "assets" / ".manifest.json") or {}
        for asset_id, entry in manifest.get("entries", {}).items():
            self.manifest[asset_id] = ManifestEntry(
                asset_id=asset_id,
                path=entry.get("path", ""),
                size=entry.get("size"),
                updated_at=entry.get("updatedAt"),
                legacy_paths=entry.get("legacyPaths", []),
            )
        return self

    # ---------- 查询 ----------
    def character_by_name(self, name: str) -> Optional[LetsCharacter]:
        for c in self.characters.values():
            if c.name == name:
                return c
        return None

    def scene_by_name(self, name: str) -> Optional[LetsScene]:
        for s in self.scenes.values():
            if s.name == name:
                return s
        return None

    def asset_id_by_path(self, path: str) -> Optional[str]:
        for asset_id, entry in self.manifest.items():
            if entry.path == path:
                return asset_id
        return None

    # ---------- 工具 ----------
    @staticmethod
    def _read_json(path: Path) -> Optional[Dict[str, Any]]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"[warn] 读取失败 {path}: {e}")
            return None

    def summary(self) -> str:
        lines = [
            f"LetsGal 工程: {self.root}",
            f"  章节顺序: {self.chapter_order}",
            f"  角色数: {len(self.characters)}",
            f"  场景数: {len(self.scenes)}",
            f"  章节文件数: {len(self.chapters)}",
            f"  manifest 条目: {len(self.manifest)}",
        ]
        return "\n".join(lines)


# ---------- 占位 ID 生成（与 LetsGal 样例一致的 hash 风格） ----------

def placeholder_id(seed: str) -> str:
    """生成标准 UUID 格式（带连字符）的确定性 ID，对齐 LetsGal 样例。"""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"storyforge::{seed}"))


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("用法: python -m letsgal <LetsGal工程目录>")
        sys.exit(1)
    proj = LetsGalProject(sys.argv[1])
    proj.load()
    print(proj.summary())
