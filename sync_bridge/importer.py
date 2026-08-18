"""LetsGal → StoryForge 反向同步（v3）。

把 LetsGal 章节同步回 StoryForge：
- 每个 LetsGal 章节文件（chapters/*.json）→ 一个小章节。
- 文本类 block（dialogue/narration/scene）→ 标准写作行。
- LetsGal 中新建的章节 → 自动新建小章节（若没有大章节，自动建「默认」大章节，插入对应位置）。
- 非文本类 block（特效/动画/音效/摄像机/branch 等）→ 忽略（不导入也不删除），保留在 LetsGal。
- 更新 mapping（记录新增 block 的 id）。

注意：本模块只修改 StoryForge 工程 JSON，不触碰 LetsGal 文件。
"""
from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from letsgal import LetsGalProject
from mapping import SyncMapping

TEXT_BLOCK_TYPES = {"dialogue", "narration", "scene"}


class SyncImporter:
    def __init__(self, storyforge_json: Dict[str, Any], letsgal_root: str | os.PathLike,
                 mapping: SyncMapping, dry_run: bool = True):
        self.sf = storyforge_json
        self.lets = LetsGalProject(letsgal_root)
        self.lets.load()
        self.mapping = mapping
        self.dry_run = dry_run
        self.char_id_by_name = {c.get("name", ""): c.get("id", "") for c in self.sf.get("characters", [])}
        self.scene_id_by_name = {s.get("name", ""): s.get("id", "") for s in self.sf.get("scenes", [])}
        self.stats = {"updated": 0, "added": 0, "ignored_effect": 0, "new_subchapters": 0}

    # ---- 主入口 ----
    def execute(self) -> Dict[str, Any]:
        # 收集 StoryForge 已有小章节（name → (chapter, sub)）
        existing_subs: Dict[str, tuple] = {}
        for chapter in self.sf.get("chapters", []):
            for sub in chapter.get("subChapters", []):
                existing_subs[sub.get("name", "")] = (chapter, sub)

        for chap_file, lg_chapter in self.lets.chapters.items():
            name = lg_chapter.name
            if name in ("开始", "游戏结束", "终章"):
                # 这些是 LetsGal 系统章节，跳过（避免污染写作层）
                continue
            # 按 fragment 名分组：文本块（lines）与外部演出块（特效/分支等，只读占位）
            frag_text_blocks: Dict[str, List] = {}
            frag_ext_blocks: Dict[str, List] = {}
            for frag in lg_chapter.fragments:
                fname = frag.name or "main"
                text_blocks = frag_text_blocks.setdefault(fname, [])
                ext_blocks = frag_ext_blocks.setdefault(fname, [])
                for b in frag.blocks:
                    if b.type in TEXT_BLOCK_TYPES:
                        text_blocks.append(b)
                    else:
                        ext_blocks.append({
                            "id": b.id,
                            "type": b.type,
                            "label": self._block_label(b),
                            "afterLineIndex": len(text_blocks),
                        })
                        self.stats["ignored_effect"] += 1

            if name in existing_subs:
                # 更新已有小章节
                chapter, sub = existing_subs[name]
                self._update_subchapter(chapter, sub, frag_text_blocks, frag_ext_blocks)
            else:
                # 新建小章节（自动归入默认大章节）
                self._create_subchapter(name, frag_text_blocks, frag_ext_blocks)
                self.stats["new_subchapters"] += 1

        if not self.dry_run:
            self.mapping.save()
        return {"dry_run": self.dry_run, "stats": self.stats, "project": self.sf}

    # ---- 更新已有小章节 ----
    def _update_subchapter(self, chapter, sub, frag_text_blocks: Dict[str, List], frag_ext_blocks: Dict[str, List]) -> None:
        cm = self.mapping.chapter_mapping(sub.get("id", ""))
        # main fragment → sub.lines
        self._sync_lines(sub.setdefault("lines", []), frag_text_blocks.get("main", []), cm)
        # main 外部演出块占位
        sub["externalBlocks"] = frag_ext_blocks.get("main", [])
        # 其他 fragment → 子片段
        sub.setdefault("fragments", [])
        for fname, blocks in frag_text_blocks.items():
            if fname == "main":
                continue
            frag = next((f for f in sub["fragments"] if f.get("name") == fname), None)
            if frag is None:
                frag = {"id": uuid.uuid4().hex, "name": fname, "lines": []}
                sub["fragments"].append(frag)
                self.stats["new_subchapters"] += 1
            # 子片段行的 ID 映射：用 fragment 名做前缀区分
            fcm_key = f"{sub.get('id', '')}::{fname}"
            self._sync_lines(frag.setdefault("lines", []), blocks, cm, prefix=fcm_key)
            frag["externalBlocks"] = frag_ext_blocks.get(fname, [])

    def _sync_lines(self, lines: List[Dict], text_blocks: List, cm, prefix: str = "") -> None:
        """把 LetsGal 文本块同步到 lines 列表（按 block id 匹配更新，新增追加）。"""
        block_to_line = {}
        for line in lines:
            bid = cm.beats.get(line.get("id", ""))
            if bid:
                block_to_line[bid] = line
        new_lines = []
        for block in text_blocks:
            bid = block.id
            if bid in block_to_line:
                self._apply_block_to_line(block_to_line[bid], block)
                self.stats["updated"] += 1
            else:
                line = self._block_to_line(block)
                if line:
                    new_lines.append(line)
                    cm.beats[line["id"]] = bid
                    self.stats["added"] += 1
        lines.extend(new_lines)

    # ---- 新建小章节 ----
    def _create_subchapter(self, name: str, frag_text_blocks: Dict[str, List], frag_ext_blocks: Dict[str, List]) -> None:
        # 找默认大章节，没有则创建
        chapter = None
        for c in self.sf.get("chapters", []):
            if c.get("name") == "默认":
                chapter = c
                break
        if chapter is None:
            chapter = {"id": uuid.uuid4().hex, "name": "默认", "summary": "", "subChapters": []}
            self.sf.setdefault("chapters", []).append(chapter)
            self.sf.setdefault("chapterOrder", []).append(chapter["id"])

        sub = {
            "id": uuid.uuid4().hex,
            "name": name,
            "date": "",
            "summary": "",
            "tags": [],
            "condense": "",
            "mode": "standard",
            "freeText": "",
            "lines": [],
            "externalBlocks": [],
            "fragments": [],
        }
        cm = self.mapping.chapter_mapping(sub["id"])
        cm.chapter_name = name
        cm.chapter_file = f"chapters/{name}.json"
        # main → lines
        self._sync_lines(sub["lines"], frag_text_blocks.get("main", []), cm)
        sub["externalBlocks"] = frag_ext_blocks.get("main", [])
        # 其他 fragment → 子片段
        for fname, blocks in frag_text_blocks.items():
            if fname == "main":
                continue
            frag = {"id": uuid.uuid4().hex, "name": fname, "lines": [], "externalBlocks": []}
            self._sync_lines(frag["lines"], blocks, cm, prefix=f"{sub['id']}::{fname}")
            frag["externalBlocks"] = frag_ext_blocks.get(fname, [])
            sub["fragments"].append(frag)
        chapter["subChapters"].append(sub)

    # ---- 外部演出块 label ----

    def _block_label(self, block) -> str:
        props = block.props or {}
        t = block.type
        if t == "branch":
            try:
                choices = json.loads(props.get("choices") or "[]")
                texts = [c.get("text", "") for c in choices if c.get("text")]
                return "分支选项：" + " / ".join(texts) if texts else "分支选项"
            except Exception:
                return "分支选项"
        if t == "particle":
            preset = props.get("preset", "")
            return f"粒子特效 {preset}".strip()
        if t == "sound":
            return f"{props.get('soundType', '音效')} {props.get('uri', '')}".strip()
        if t == "curtain":
            return f"黑幕（{props.get('op', '')}）"
        if t == "floatingText":
            return "浮动文字"
        if t == "camera":
            return "镜头"
        if t == "background":
            return "背景"
        return t

    # ---- block → line ----
    def _block_to_line(self, block) -> Optional[Dict[str, Any]]:
        props = block.props
        content = block.content or []
        text = ""
        if content and isinstance(content[0], dict):
            text = content[0].get("text", "")
        kind = block.type
        if kind == "dialogue":
            name = props.get("characterName", "")
            cid = self.char_id_by_name.get(name, "")
            return {
                "id": uuid.uuid4().hex,
                "kind": "dialogue",
                "characterId": cid,
                "characterName": name,
                "expression": props.get("expression", ""),
                "text": text,
            }
        if kind == "narration":
            return {"id": uuid.uuid4().hex, "kind": "narration", "text": text}
        if kind == "scene":
            sname = props.get("sceneName", "")
            sid = self.scene_id_by_name.get(sname, "")
            return {"id": uuid.uuid4().hex, "kind": "scene", "sceneId": sid, "sceneName": sname}
        return None

    def _apply_block_to_line(self, line, block) -> None:
        props = block.props
        content = block.content or []
        text = ""
        if content and isinstance(content[0], dict):
            text = content[0].get("text", "")
        if block.type == "dialogue":
            line["text"] = text
            line["expression"] = props.get("expression", line.get("expression", ""))
            name = props.get("characterName", "")
            if name:
                line["characterName"] = name
                line["characterId"] = self.char_id_by_name.get(name, line.get("characterId", ""))
        elif block.type == "narration":
            line["text"] = text
        elif block.type == "scene":
            sname = props.get("sceneName", "")
            if sname:
                line["sceneName"] = sname
                line["sceneId"] = self.scene_id_by_name.get(sname, line.get("sceneId", ""))


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 4:
        print("用法: python -m importer <StoryForge工程.json> <LetsGal工程目录> <sync.json路径> [--apply]")
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

    imp = SyncImporter(sf_data, lg_root, mapping, dry_run=dry_run)
    result = imp.execute()
    out = json.dumps(result, ensure_ascii=False, indent=2)
    sys.stdout.buffer.write(out.replace("\r\n", "\n").encode("utf-8"))
    if dry_run:
        sys.stdout.buffer.write("\n[dry-run] not applied.\n".encode("utf-8"))
