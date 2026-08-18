/**
 * 项目结构（v3）。
 *
 * 层级：Project → Chapter（大章节，仅 StoryForge 分组用）→ SubChapter（小章节，= LetsGal 章节）。
 * 小章节 = LetsGal 章节（chapters/*.json，文件名即章节名）。
 * 大章节不映射到 LetsGal，只用于 StoryForge 内部分组显示。
 */
import type { EntityId, StoryDate } from './ids';
import type { ScriptLine, SubFragment, ExternalBlock } from './beat';
import type { Character } from './character';
import type { Scene } from './scene';
import type { Foreshadow } from './foreshadow';

/** 写作模式 */
export type WritingMode = 'standard' | 'free';

/** 小章节（= LetsGal 章节） */
export interface SubChapter {
  id: EntityId;
  /** 小章节名（= LetsGal 章节名） */
  name: string;
  /** 时间线日期（仅 StoryForge 内部使用，辅助写作） */
  date: StoryDate;
  /** 剧情概要（写作指引） */
  summary: string;
  /** 标签 */
  tags: string[];
  /** 剧情浓缩（压缩上下文，可为空） */
  condense: string;
  /** 写作模式 */
  mode: WritingMode;
  /** 自由写作内容（mode=free 时使用，不同步 LetsGal） */
  freeText: string;
  /** 标准写作行（mode=standard 时使用，即 main 片段内容） */
  lines: ScriptLine[];
  /** 外部演出块占位（LetsGal 特效/分支等，只读展示） */
  externalBlocks?: ExternalBlock[];
  /** 章节内片段（子片段，对应 LetsGal fragment） */
  fragments: SubFragment[];
}

/** 大章节（仅 StoryForge 分组用） */
export interface Chapter {
  id: EntityId;
  name: string;
  summary?: string;
  subChapters: SubChapter[];
}

/** 工程 */
export interface Project {
  id: EntityId;
  name: string;
  version: string;
  /** 项目存储根目录（新建项目时选择） */
  storageDir?: string;
  /** 整体世界观 */
  worldview: string;
  /** 人设 */
  characters: Character[];
  /** 场景（名称唯一） */
  scenes: Scene[];
  /** 大章节顺序 */
  chapterOrder: EntityId[];
  /** 大章节 */
  chapters: Chapter[];
  /** 伏笔 */
  foreshadows: Foreshadow[];
  /** 扩展字段（保留，如 LetsGal 同步元数据） */
  extra?: Record<string, unknown>;
}
