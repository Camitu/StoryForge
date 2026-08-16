/**
 * 工程结构与章节管理。
 * 层级：Project → Chapter（大章节，如「序章」）→ SubChapter（子章节，如「000 突如其来的夏日」）
 *       → Section（小节，对应一个时间段）→ Beat。
 *
 * 章节管理是重点：大章节/子章节可展开折叠、卡片式/积木式拖动衔接；
 * 拖动后重设时间线即可（支持先写高潮再回填铺垫）。
 */
import type { EntityId, StoryTime } from './ids';
import type { Beat, Anchor } from './beat';
import type { Character } from './character';
import type { Scene } from './scene';
import type { Foreshadow } from './foreshadow';
import type { StateDelta } from './state';
import type { Asset } from './asset';

/** 分辨率 */
export interface Resolution {
  width: number;
  height: number;
}

/**
 * 小节（Section）—— 对应「一个时间段」。
 * 点开后包含：剧情概要、剧情标签、伏笔（新增/回收）、剧情浓缩。
 */
export interface Section {
  id: EntityId;
  name: string;
  /** 时间段 */
  time: StoryTime;
  /** 剧情概要（写作指引：尽量涵盖本小节全部剧情） */
  summary: string;
  /** 剧情浓缩（压缩上下文：只记会影响后续的关键点） */
  condense?: StateDelta;
  /** 本节伏笔（埋设/回收） */
  foreshadows?: Foreshadow[];
  /** 锚点（固定内容，AI 不得改） */
  anchors?: Anchor[];
  /** 标签（可多选，无则新增） */
  tags?: string[];
  /** 本节 beat 列表 */
  beats: Beat[];
}

/** 子章节（SubChapter）—— 大章节下的一个标题单元，如「000 突如其来的夏日」 */
export interface SubChapter {
  id: EntityId;
  name: string;
  /** 子章节概要 */
  summary?: string;
  sections: Section[];
}

/** 大章节（Chapter）—— 如「序章」 */
export interface Chapter {
  id: EntityId;
  name: string;
  /** 章节概要 */
  summary?: string;
  subChapters: SubChapter[];
}

/** 工程（Project） */
export interface Project {
  id: EntityId;
  name: string;
  version: string;
  resolution: Resolution;
  /** 章节顺序（可拖拽重排） */
  chapterOrder: EntityId[];
  chapters: Chapter[];
  characters: Character[];
  scenes: Scene[];
  /** 全局变量 / 旗标 */
  variables?: Record<string, string | number | boolean>;
  /** 资产库 */
  assets?: Asset[];
}
