"""核心逻辑：叙事状态快照计算 + 一致性检查（机械校验）。"""
from typing import List, Optional

from .models import CharacterState, Project, StateDelta, WorldState


def _base_state(project: Project) -> WorldState:
    char_states = {}
    for c in project.characters:
        char_states[c.id] = CharacterState(
            characterId=c.id,
            attributeValues=dict(c.attributeValues or {}),
        )
    return WorldState(
        atTime="",
        characterStates=char_states,
        flags=dict(project.variables or {}),
        openForeshadows=[],
    )


def _apply_delta(state: WorldState, delta: StateDelta) -> None:
    for cid, cs in delta.characterStateChanges.items():
        state.characterStates[cid] = cs
    for k, v in delta.flagChanges.items():
        state.flags[k] = v
    for fs in delta.foreshadowsPlanted:
        fs.status = "open"
        state.openForeshadows.append(fs)
    resolved = set(delta.foreshadowsResolved)
    if resolved:
        state.openForeshadows = [
            f for f in state.openForeshadows if f.id not in resolved
        ]


def _walk_sections(project: Project):
    """按 chapterOrder 顺序遍历 (chapter, section)。"""
    chapter_map = {c.id: c for c in project.chapters}
    for cid in project.chapterOrder:
        chapter = chapter_map.get(cid)
        if chapter is None:
            continue
        for sub in chapter.subChapters:
            for section in sub.sections:
                yield chapter, section


def compute_context(project: Project, at: Optional[str] = None) -> WorldState:
    """计算叙事世界状态快照（WorldState）。

    - at 省略：返回最终状态（走完全部章节）。
    - at = sectionId：返回「应用完该节（含）之后」的状态。
    """
    state = _base_state(project)
    for _chapter, section in _walk_sections(project):
        if section.condense is not None:
            _apply_delta(state, section.condense)
        for fs in section.foreshadows:
            if fs.status == "open":
                state.openForeshadows.append(fs)
        state.atTime = section.time
        if at is not None and section.id == at:
            return state
    return state


def check_project(project: Project) -> dict:
    """机械一致性检查。"""
    issues: List[str] = []
    char_ids = {c.id for c in project.characters}
    scene_ids = {s.id for s in project.scenes}
    chapter_ids = {c.id for c in project.chapters}
    section_ids = {s.id for c in project.chapters for sc in c.subChapters for s in sc.sections}
    beat_ids = set()
    anchor_beat_ids = set()

    # chapterOrder 一致性
    for cid in project.chapterOrder:
        if cid not in chapter_ids:
            issues.append(f"chapterOrder 引用不存在的章节: {cid}")
    for cid in chapter_ids:
        if cid not in project.chapterOrder:
            issues.append(f"章节未出现在 chapterOrder: {cid}")

    open_fs = []
    for chapter, section in _walk_sections(project):
        for beat in section.beats:
            if beat.id:
                beat_ids.add(beat.id)
            if beat.kind == "dialogue":
                if beat.characterId and beat.characterId not in char_ids:
                    issues.append(f"[{chapter.name}/{section.name}] 对白引用未定义角色: {beat.characterId}")
                if beat.sceneId and beat.sceneId not in scene_ids:
                    issues.append(f"[{chapter.name}/{section.name}] 对白引用未定义场景: {beat.sceneId}")
            elif beat.kind == "scene":
                if beat.sceneId not in scene_ids:
                    issues.append(f"[{chapter.name}/{section.name}] 切场景引用未定义场景: {beat.sceneId}")
            elif beat.kind == "character":
                if beat.characterId not in char_ids:
                    issues.append(f"[{chapter.name}/{section.name}] 引用未定义角色: {beat.characterId}")
            elif beat.kind == "choice":
                for opt in beat.options:
                    if opt.target not in section_ids:
                        issues.append(f"[{chapter.name}/{section.name}] 分支跳转目标不存在: {opt.target}")
            elif beat.kind == "jump":
                if beat.target not in section_ids:
                    issues.append(f"[{chapter.name}/{section.name}] 跳转目标不存在: {beat.target}")

        for fs in section.foreshadows:
            if fs.status == "open":
                open_fs.append(fs)
        for anc in section.anchors:
            anchor_beat_ids.add(anc.beatId)

    for fs in open_fs:
        issues.append(f"未回收伏笔: {fs.content}")

    for bid in anchor_beat_ids:
        if bid not in beat_ids:
            issues.append(f"锚点指向不存在的 beat: {bid}")

    return {"ok": len(issues) == 0, "issue_count": len(issues), "issues": issues}
