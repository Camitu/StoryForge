"""StoryForge ↔ LetsGal ID 映射存储。

每个 StoryForge 工程对应一个 `{project_id}.sync.json`（放在 server/data/），
记录：
- letsgalDir：绑定的 LetsGal 工程目录
- chapters[chapterId]：章节映射（LetsGal 章节文件名）
- beats[beatId]：beat ↔ LetsGal block id 映射

用途：双向同步时按 ID 定位 LetsGal block，做到增量更新、保留演出配置。
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class ChapterMapping:
    chapter_name: str = ""          # LetsGal 章节名（如「序章-2」）
    chapter_file: str = ""          # 相对路径 chapters/xxx.json
    fragment_name: str = "main"     # 目标 fragment
    beats: Dict[str, str] = field(default_factory=dict)  # sf_beat_id -> letsgal_block_id


class SyncMapping:
    """读写 `{project_id}.sync.json`。"""

    def __init__(self, project_id: str, data_dir: str | os.PathLike):
        self.project_id = project_id
        self.path = Path(data_dir) / f"{project_id}.sync.json"
        self.letsgal_dir: str = ""
        self.chapters: Dict[str, ChapterMapping] = {}

    def load(self) -> "SyncMapping":
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                self.letsgal_dir = raw.get("letsgalDir", "")
                for cid, cm in raw.get("chapters", {}).items():
                    self.chapters[cid] = ChapterMapping(
                        chapter_name=cm.get("chapterName", ""),
                        chapter_file=cm.get("chapterFile", ""),
                        fragment_name=cm.get("fragmentName", "main"),
                        beats=dict(cm.get("beats", {})),
                    )
            except (json.JSONDecodeError, OSError):
                pass
        return self

    def save(self) -> None:
        raw = {
            "projectId": self.project_id,
            "letsgalDir": self.letsgal_dir,
            "chapters": {
                cid: {
                    "chapterName": cm.chapter_name,
                    "chapterFile": cm.chapter_file,
                    "fragmentName": cm.fragment_name,
                    "beats": cm.beats,
                }
                for cid, cm in self.chapters.items()
            },
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(raw, f, ensure_ascii=False, indent=2)

    # ---- 便捷方法 ----
    def chapter_mapping(self, chapter_id: str) -> ChapterMapping:
        if chapter_id not in self.chapters:
            self.chapters[chapter_id] = ChapterMapping()
        return self.chapters[chapter_id]

    def block_id_for_beat(self, chapter_id: str, beat_id: str) -> Optional[str]:
        cm = self.chapters.get(chapter_id)
        if cm:
            return cm.beats.get(beat_id)
        return None

    def bind_beat(self, chapter_id: str, beat_id: str, block_id: str) -> None:
        self.chapter_mapping(chapter_id).beats[beat_id] = block_id
