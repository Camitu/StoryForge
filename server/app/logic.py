"""核心逻辑（v3）：一致性检查（机械校验）。

- 章节结构：chapterOrder 一致性、大章节/小章节引用。
- 角色引用：小章节行引用的角色必须在人设中定义。
- 场景引用：小章节行引用的场景必须在场景列表中。
- 伏笔：未回收伏笔提醒；回收位置指向存在的行。
- 人设删除检查：角色是否被章节行引用（供删除前校验）。
"""
from typing import List, Optional

from .models import Chapter, Project, ScriptLine, SubChapter


def _iter_lines(project: Project):
    """按 chapterOrder 顺序遍历 (chapter, subchapter, line)。"""
    chapter_map = {c.id: c for c in project.chapters}
    for cid in project.chapterOrder:
        chapter = chapter_map.get(cid)
        if chapter is None:
            continue
        for sub in chapter.subChapters:
            for line in sub.lines:
                yield chapter, sub, line


def character_references(project: Project, character_id: str) -> List[str]:
    """返回引用指定角色的位置描述列表（删除人设前检查）。"""
    refs = []
    for chapter, sub, line in _iter_lines(project):
        if getattr(line, "characterId", None) == character_id:
            refs.append(f"{chapter.name}/{sub.name}")
    return refs


def check_project(project: Project) -> dict:
    """机械一致性检查。"""
    issues: List[str] = []
    char_ids = {c.id for c in project.characters}
    scene_ids = {s.id for s in project.scenes}
    chapter_ids = {c.id for c in project.chapters}
    subchapter_ids = {sc.id for c in project.chapters for sc in c.subChapters}

    # chapterOrder 一致性
    for cid in project.chapterOrder:
        if cid not in chapter_ids:
            issues.append(f"chapterOrder 引用不存在的章节: {cid}")
    for cid in chapter_ids:
        if cid not in project.chapterOrder:
            issues.append(f"章节未出现在 chapterOrder: {cid}")

    # 小章节名唯一性（= LetsGal 章节名，必须唯一）
    seen_names = {}
    for c in project.chapters:
        for sc in c.subChapters:
            if sc.name in seen_names:
                issues.append(f"小章节名重复（LetsGal 章节名必须唯一）: {sc.name}")
            seen_names[sc.name] = sc.id

    # 场景名唯一性
    seen_scene_names = {}
    for s in project.scenes:
        if s.name in seen_scene_names:
            issues.append(f"场景名重复: {s.name}")
        seen_scene_names[s.name] = s.id

    # 行引用检查
    open_fs = []
    for chapter, sub, line in _iter_lines(project):
        loc = f"[{chapter.name}/{sub.name}]"
        if line.kind == "dialogue":
            if line.characterId and line.characterId not in char_ids:
                issues.append(f"{loc} 对白引用未定义角色: {line.characterId}")
            if line.sceneId and line.sceneId not in scene_ids:
                issues.append(f"{loc} 对白引用未定义场景: {line.sceneId}")
        elif line.kind == "scene":
            if line.sceneId not in scene_ids:
                issues.append(f"{loc} 切场景引用未定义场景: {line.sceneId}")
        elif line.kind == "narration":
            if line.sceneId and line.sceneId not in scene_ids:
                issues.append(f"{loc} 旁白引用未定义场景: {line.sceneId}")

    # 伏笔检查
    for fs in project.foreshadows:
        if fs.status == "open":
            open_fs.append(fs.content)
        if fs.resolvedAt and fs.resolvedAt.subChapterId not in subchapter_ids:
            issues.append(f"伏笔回收位置指向不存在的小章节: {fs.resolvedAt.subChapterId}")

    for content in open_fs:
        issues.append(f"未回收伏笔: {content}")

    return {"ok": len(issues) == 0, "issue_count": len(issues), "issues": issues}


def get_subchapter(project: Project, subchapter_id: str):
    """查找小章节，返回 (chapter, subchapter) 或 None。"""
    for chapter in project.chapters:
        for sub in chapter.subChapters:
            if sub.id == subchapter_id:
                return chapter, sub
    return None
