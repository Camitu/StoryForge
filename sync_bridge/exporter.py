"""StoryForge → LetsGal 增量导出（同步）（v3）。

把 StoryForge v3 工程同步到 LetsGal 工程：
- 小章节（subChapter）→ LetsGal chapters/{name}.json。
- 标准写作行（lines）→ LetsGal blocks（dialogue/narration/scene）。
- 自由写作（mode=free）不同步。
- 角色/场景缺失 → 创建占位实体（characters.json / scenes.json / manifest）。
- 增量更新：按 ID 映射更新文本类 block，保留 LetsGal 里的演出 props（特效/动画/音效）。
- 更新 project.json：chapterOrder + chapterTreeOrder。
"""
from __future__ import annotations

import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from letsgal import LetsGalProject, placeholder_id
from mapping import SyncMapping

# 文本类 block（StoryForge 负责更新的类型）
TEXT_BLOCK_TYPES = {"dialogue", "narration", "scene"}


# ---------- 默认 props 模板（对齐 LetsGal 样例） ----------

def _dialogue_props(character_id: str, character_name: str, expression: str = "", voice_hash: str = "") -> Dict[str, Any]:
    return {
        "disabled": False,
        "characterId": character_id,
        "characterName": character_name,
        "nameVariantId": "",
        "expression": expression,
        "skin": "",
        "distance": "",
        "position": "",
        "isFirst": True,
        "isLast": True,
        "prevExpression": "",
        "prevNameVariantId": "",
        "showCharacter": True,
        "dialoguePortraitOnly": False,
        "keepCharacter": True,
        "keepDialogue": True,
        "voiceHash": voice_hash,
        "entryMotionPreset": "",
        "entryMotionDuration": 300,
        "entryMotionIntensity": 1,
        "entryMotionDirection": "auto",
        "entryMotionWait": False,
        "exitMotionPreset": "",
        "exitMotionDuration": 300,
        "exitMotionIntensity": 1,
        "exitMotionDirection": "auto",
        "exitMotionWait": True,
    }


def _scene_props(scene_id: str, scene_name: str, transition_mode: str = "cut", transition_duration: int = 500) -> Dict[str, Any]:
    return {
        "disabled": False,
        "sceneId": scene_id,
        "sceneName": scene_name,
        "uri": "",
        "autoAddToGallery": "true",
        "galleryMethodTarget": "avg.internal.default-shell/add-to-gallery",
        "transitionMode": transition_mode,
        "transitionDuration": str(transition_duration),
        "transitionDirection": "",
        "transitionStrips": "12",
        "transitionRuleUri": "",
        "transitionCenterX": "50",
        "transitionCenterY": "50",
        "transitionSoftness": "",
        "transitionZoomScale": "1.14",
        "transitionBlurStrength": "16",
        "transitionMosaicSize": "52",
        "transitionGlitchStrength": "100",
        "transitionGlitchColorShift": "4.5",
        "transitionGlitchScanlines": "17",
        "transitionPagePerspective": "50",
        "transitionPageShadow": "38",
        "waitForComplete": "false",
        "resetCamera": "false",
        "displayType": "cover",
        "position": "(center,center)",
        "anchor": "center",
        "size": "",
    }


def _narration_props() -> Dict[str, Any]:
    return {"disabled": False, "keepDialogue": True, "voiceHash": ""}


# ---------- 符号对齐（角色/场景） ----------

class SymbolMapper:
    """把 StoryForge 角色/场景映射为 LetsGal ID。"""

    def __init__(self, lets: LetsGalProject):
        self.lets = lets
        self.char_by_name = {c.name: c.id for c in lets.characters.values()}
        self.scene_by_name = {s.name: s.id for s in lets.scenes.values()}
        self.pending_characters: List[Dict[str, Any]] = []
        self.pending_scenes: List[Dict[str, Any]] = []
        self.pending_manifest: List[Dict[str, Any]] = []

    def map_character(self, story_id: str, name: str) -> str:
        if name in self.char_by_name:
            return self.char_by_name[name]
        cid = placeholder_id(f"char::{story_id}::{name}")
        self.pending_characters.append({
            "id": cid,
            "name": name,
            "expressions": [{"name": "默认", "assetPath": f"characters/{name}/占位.png"}],
            "themeColor": {"bg": "#dbeafe", "fg": "#1e40af", "ring": "#60a5fa"},
            "attributeValues": {},
        })
        self.char_by_name[name] = cid
        self._register_placeholder(f"characters/{name}/占位.png")
        return cid

    def map_scene(self, story_id: str, name: str) -> str:
        if name in self.scene_by_name:
            return self.scene_by_name[name]
        sid = placeholder_id(f"scene::{story_id}::{name}")
        self.pending_scenes.append({
            "id": sid,
            "name": name,
            "layers": [{
                "id": placeholder_id(f"layer::{story_id}::{name}::0"),
                "name": "背景",
                "assetPath": f"backgrounds/{name}/占位.png",
                "distance": 1,
            }],
        })
        self.scene_by_name[name] = sid
        self._register_placeholder(f"backgrounds/{name}/占位.png")
        return sid

    def _register_placeholder(self, asset_path: str) -> None:
        if self.lets.asset_id_by_path(asset_path):
            return
        aid = placeholder_id(f"asset::{asset_path}")
        self.pending_manifest.append({
            "asset_id": aid,
            "path": asset_path,
            "size": 0,
            "updated_at": int(time.time() * 1000),
        })


# ---------- 增量同步主流程 ----------

class SyncExporter:
    """把 StoryForge v3 工程增量同步到 LetsGal 工程。"""

    def __init__(self, storyforge_json: Dict[str, Any], letsgal_root: str | os.PathLike,
                 mapping: SyncMapping, dry_run: bool = True):
        self.sf = storyforge_json
        self.lets = LetsGalProject(letsgal_root)
        self.lets.load()
        self.mapping = mapping
        self.dry_run = dry_run
        self.mapper = SymbolMapper(self.lets)
        self.stats = {"updated": 0, "added": 0, "skipped_effect_blocks": 0}
        self.written_chapters: List[Dict[str, Any]] = []

    # ---- 主入口 ----
    def execute(self) -> Dict[str, Any]:
        results = []
        for chapter in self.sf.get("chapters", []):
            for sub in chapter.get("subChapters", []):
                results.append(self._sync_subchapter(chapter, sub))

        if not self.dry_run:
            self._merge_characters()
            self._merge_scenes()
            self._merge_manifest()
            self._merge_project()
            self.mapping.save()
        return {
            "dry_run": self.dry_run,
            "stats": self.stats,
            "chapters": results,
            "pendingCharacters": self.mapper.pending_characters,
            "pendingScenes": self.mapper.pending_scenes,
            "pendingManifest": self.mapper.pending_manifest,
        }

    # ---- 小章节同步 ----
    def _sync_subchapter(self, chapter: Dict[str, Any], sub: Dict[str, Any]) -> Dict[str, Any]:
        sub_id = sub.get("id", "")
        sub_name = sub.get("name", "未命名")
        chapter_name = chapter.get("name", "默认")
        cm = self.mapping.chapter_mapping(sub_id)

        target_file = cm.chapter_file or self._resolve_chapter_file(sub_name)
        target_path = self.lets.root / target_file

        # 读取 LetsGal 现有章节的全部 fragments（保留演出块与 branch/callFragment 逻辑）
        existing_frags: Dict[str, Dict[str, Any]] = {}   # name -> fragment
        existing_chapter = None
        if target_path.exists():
            try:
                with open(target_path, "r", encoding="utf-8") as f:
                    existing_chapter = json.load(f)
                for frag in existing_chapter.get("fragments", []):
                    existing_frags[frag.get("name", "main")] = frag
            except (json.JSONDecodeError, OSError):
                existing_chapter = None

        # 纯自由写作（无标准行/片段）不导出；free 模式但有标准内容的章节照常导出
        has_standard = bool(sub.get("lines")) or bool(sub.get("fragments"))
        if sub.get("mode") == "free" and not has_standard:
            return {"chapterId": chapter_name, "file": target_file, "blocks": 0,
                    "updated": 0, "added": 0, "preservedEffectBlocks": 0, "skippedFree": True}

        # 1. main fragment：由小章节 lines 编译（增量更新，保留演出块）
        main_frag = self._compile_fragment(
            frag_name="main",
            frag_id=placeholder_id(f"fragment::{sub_id}::main"),
            lines=sub.get("lines", []),
            existing_frag=existing_frags.get("main"),
            block_map=cm.beats,
            sub_id=sub_id,
            chapter_name=chapter_name,
        )

        # 2. 子片段：小章节 fragments → 命名 fragment
        out_frags = [main_frag]
        for frag in sub.get("fragments", []):
            fname = frag.get("name", "片段")
            frag_id = placeholder_id(f"fragment::{sub_id}::{fname}")
            compiled_frag = self._compile_fragment(
                frag_name=fname,
                frag_id=frag_id,
                lines=frag.get("lines", []),
                existing_frag=existing_frags.get(fname),
                block_map=cm.beats,  # 复用同一映射（key 用 line id，全局唯一即可）
                sub_id=sub_id,
                chapter_name=chapter_name,
            )
            out_frags.append(compiled_frag)

        # 3. 保留 LetsGal 里其他未被管理的 fragment（如分支片段、人工片段），不覆盖
        managed_names = {"main"} | {f.get("name", "片段") for f in sub.get("fragments", [])}
        for fname, frag in existing_frags.items():
            if fname not in managed_names:
                out_frags.append(frag)
                self.stats["skipped_effect_blocks"] += len(frag.get("blocks", []))

        chapter_out = {
            "id": existing_chapter.get("id") if existing_chapter else placeholder_id(f"chapter::{sub_id}::{sub_name}"),
            "name": sub_name,
            "fragments": out_frags,
        }

        if not self.dry_run:
            self._atomic_write(target_path, chapter_out)
            cm.chapter_name = sub_name
            cm.chapter_file = target_file
            cm.fragment_name = "main"
            self.written_chapters.append({
                "chapter_id": chapter_out["id"],
                "chapter_name": chapter_out["name"],
            })

        total_blocks = sum(len(f.get("blocks", [])) for f in out_frags)
        return {"chapterId": sub_id, "file": target_file, "blocks": total_blocks,
                "updated": self.stats["updated"], "added": self.stats["added"],
                "preservedEffectBlocks": self.stats["skipped_effect_blocks"]}

    def _compile_fragment(self, frag_name: str, frag_id: str, lines: List[Dict[str, Any]],
                          existing_frag: Optional[Dict[str, Any]], block_map: Dict[str, str],
                          sub_id: str, chapter_name: str) -> Dict[str, Any]:
        """编译一个 fragment：增量更新文本块，保留演出块。"""
        existing_blocks: Dict[str, Dict[str, Any]] = {}
        if existing_frag:
            for b in existing_frag.get("blocks", []):
                if b.get("id"):
                    existing_blocks[b["id"]] = b

        new_blocks: List[Dict[str, Any]] = []
        for line in lines:
            line_id = line.get("id") or uuid.uuid4().hex
            block_id = block_map.get(line_id)
            compiled = self._compile_line(line, block_id, sub_id, chapter_name)
            if compiled is None:
                continue
            if block_id and block_id in existing_blocks:
                new_blocks.append(self._merge_text_block(existing_blocks[block_id], compiled))
                self.stats["updated"] += 1
            else:
                new_blocks.append(compiled)
                block_map[line_id] = compiled["id"]
                self.stats["added"] += 1

        # 按原顺序合并：文本块原位更新，特效/分支等演出块原位保留，新增文本块追加末尾
        # ⚠️ 不能用 preserved + new_blocks（会把特效/分支全部挪到开头）
        new_by_id = {b["id"]: b for b in new_blocks}
        used_ids = set()
        final_blocks: List[Dict[str, Any]] = []
        for b in (existing_frag.get("blocks", []) if existing_frag else []):
            bid = b.get("id")
            if b.get("type") in TEXT_BLOCK_TYPES and bid in new_by_id:
                final_blocks.append(new_by_id[bid])
                used_ids.add(bid)
            else:
                final_blocks.append(b)  # 特效/分支/未知块：原样保留原位
        for b in new_blocks:
            if b["id"] not in used_ids:
                final_blocks.append(b)
                used_ids.add(b["id"])

        preserved_count = sum(1 for b in (existing_frag.get("blocks", []) if existing_frag else [])
                              if b.get("type") not in TEXT_BLOCK_TYPES)
        self.stats["skipped_effect_blocks"] += preserved_count

        return {
            "id": existing_frag.get("id") if existing_frag else frag_id,
            "name": frag_name,
            "blocks": final_blocks,
        }

    # ---- line → block 编译 ----
    def _compile_line(self, line: Dict[str, Any], existing_block_id: Optional[str],
                      sub_id: str, chapter_name: str) -> Optional[Dict[str, Any]]:
        kind = line.get("kind")
        line_id = line.get("id") or ""
        # 标准 UUID（带连字符）：优先复用既有 block id（增量更新），新 block 用确定性 UUID，对齐 LetsGal 格式
        # ⚠️ 不能用 StoryForge 的 line id（32hex 无连字符），LetsGal 会解析失败
        bid = existing_block_id or placeholder_id(f"block::{sub_id}::{line_id}")

        if kind == "dialogue":
            char_name = line.get("characterName") or "未命名"
            char_id = self.mapper.map_character(line.get("characterId", ""), char_name)
            return {
                "id": bid,
                "type": "dialogue",
                "props": _dialogue_props(char_id, char_name, line.get("expression", "")),
                "content": [{"type": "text", "text": line.get("text", ""), "styles": {}}],
            }
        if kind == "narration":
            return {
                "id": bid,
                "type": "narration",
                "props": _narration_props(),
                "content": [{"type": "text", "text": line.get("text", ""), "styles": {}}],
            }
        if kind == "scene":
            scene_name = line.get("sceneName") or "未命名"
            scene_id = self.mapper.map_scene(line.get("sceneId", ""), scene_name)
            return {
                "id": bid,
                "type": "scene",
                "props": _scene_props(scene_id, scene_name),
            }
        return None

    def _merge_text_block(self, old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(old)
        merged["type"] = new["type"]
        for k in ("characterId", "characterName", "expression"):
            if k in new.get("props", {}):
                merged.setdefault("props", {})[k] = new["props"][k]
        merged["content"] = new.get("content", old.get("content", []))
        return merged

    # ---- 文件处理 ----
    def _resolve_chapter_file(self, sub_name: str) -> str:
        chapters_dir = self.lets.root / "chapters"
        existing = {p.stem for p in chapters_dir.glob("*.json")} if chapters_dir.is_dir() else set()
        base = sub_name
        if base not in existing:
            return f"chapters/{base}.json"
        i = 2
        while f"{base}-{i}" in existing:
            i += 1
        return f"chapters/{base}-{i}.json"

    def _merge_characters(self) -> None:
        if not self.mapper.pending_characters:
            return
        path = self.lets.root / "characters.json"
        data = self._read_json(path) or {"version": 2, "globalSettings": {}, "attributeTemplate": [], "characters": []}
        data["characters"] = data.get("characters", []) + self.mapper.pending_characters
        self._atomic_write(path, data)

    def _merge_scenes(self) -> None:
        if not self.mapper.pending_scenes:
            return
        path = self.lets.root / "scenes.json"
        data = self._read_json(path) or {"version": 3, "scenes": [], "groups": [], "layout": {}}
        data["scenes"] = data.get("scenes", []) + self.mapper.pending_scenes
        self._atomic_write(path, data)

    def _merge_manifest(self) -> None:
        if not self.mapper.pending_manifest:
            return
        path = self.lets.root / "assets" / ".manifest.json"
        data = self._read_json(path) or {"version": 1, "entries": {}}
        for entry in self.mapper.pending_manifest:
            data.setdefault("entries", {})[entry["asset_id"]] = {
                "path": entry["path"], "size": entry["size"], "updatedAt": entry["updated_at"],
            }
        self._atomic_write(path, data)

    def _merge_project(self) -> None:
        """更新 project.json：chapterOrder + chapterTreeOrder（新版本 LetsGal 用）。"""
        path = self.lets.root / "project.json"
        proj = self._read_json(path)
        if proj is None:
            return
        chapter_id_by_name = {}
        real_chapter_ids = set()
        chapters_dir = self.lets.root / "chapters"
        if chapters_dir.is_dir():
            for p in chapters_dir.glob("*.json"):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        cd = json.load(f)
                    chapter_id_by_name[cd.get("name", "")] = cd.get("id", "")
                    real_chapter_ids.add(cd.get("id", ""))
                except (json.JSONDecodeError, OSError):
                    continue
        existing_order = list(proj.get("chapterOrder") or [])
        existing_tree = list(proj.get("chapterTreeOrder") or [])
        existing_tree = [
            t for t in existing_tree
            if not (isinstance(t, dict) and t.get("type") == "chapter" and t.get("id") not in real_chapter_ids)
        ]
        existing_tree_ids = {t.get("id") for t in existing_tree if isinstance(t, dict)}
        for wc in self.written_chapters:
            cid = wc["chapter_id"]
            cname = wc["chapter_name"]
            if cname not in existing_order:
                existing_order.append(cname)
            actual_id = chapter_id_by_name.get(cname, cid)
            if actual_id not in existing_tree_ids:
                existing_tree.append({"type": "chapter", "id": actual_id})
                existing_tree_ids.add(actual_id)
        proj["chapterOrder"] = existing_order
        proj["chapterTreeOrder"] = existing_tree
        self._atomic_write(path, proj)

    @staticmethod
    def _read_json(path: Path) -> Optional[Dict[str, Any]]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    @staticmethod
    def _atomic_write(path: Path, data: Dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        shutil.move(str(tmp), str(path))


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 4:
        print("用法: python -m exporter <StoryForge工程.json> <LetsGal工程目录> <sync.json路径> [--apply]")
        sys.exit(1)
    sf_path = Path(sys.argv[1])
    lg_root = sys.argv[2]
    mapping_path = Path(sys.argv[3])
    dry_run = "--apply" not in sys.argv

    with open(sf_path, "r", encoding="utf-8") as f:
        sf_data = json.load(f)

    mapping = SyncMapping(sf_data.get("id", "unknown"), str(mapping_path.parent))
    mapping.path = mapping_path
    mapping.load()

    exp = SyncExporter(sf_data, lg_root, mapping, dry_run=dry_run)
    result = exp.execute()
    out = json.dumps(result, ensure_ascii=False, indent=2)
    sys.stdout.buffer.write(out.replace("\r\n", "\n").encode("utf-8"))
    if dry_run:
        sys.stdout.buffer.write("\n[dry-run] not applied.\n".encode("utf-8"))
