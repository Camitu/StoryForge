/**
 * 叙事状态压缩（Narrative State Diff）—— 全系统的灵魂。
 *
 * 主线：
 *   时间线 + 人物状态 + 未回收伏笔 + 各节点浓缩 = 可随时「快照」的叙事世界状态。
 *
 * AI 写任意小节，只需「当前世界状态快照 + 该小节附近锚点」，不必读全文。
 *
 * 两个核心概念：
 * - WorldState（快照）：某一时间点的完整叙事世界状态。
 * - StateDelta（浓缩/差量）：某一节产生的「状态变化」，只保留会影响后续的关键点。
 */
import type { EntityId } from './ids';
import type { CharacterState } from './character';
import type { Foreshadow } from './foreshadow';

/**
 * 叙事世界状态快照。
 */
export interface WorldState {
  /** 快照对应的时间点 */
  atTime: string;
  /** 人物状态（关系/性格/属性） */
  characterStates: Record<EntityId, CharacterState>;
  /** 游戏变量 / 旗标 */
  flags: Record<string, string | number | boolean>;
  /** 未回收伏笔 */
  openForeshadows: Foreshadow[];
  /** 世界观 / 设定状态（可选） */
  worldNotes?: string;
}

/**
 * 剧情浓缩（State Delta）—— 某节产生的「状态差量」。
 *
 * 与「剧情概要」的区别：
 * - 概要：概括「这一节发生了什么」，是写作指引。
 * - 浓缩：只记录「哪些事改变了世界状态、会影响后续」，是压缩后的上下文。
 *   无关氛围 / 插科打诨可压缩为一句话甚至忽略。
 */
export interface StateDelta {
  /** 来源节 */
  sectionId: EntityId;
  /** 人物状态变化（可增可减） */
  characterStateChanges: Record<EntityId, Partial<CharacterState>>;
  /** 旗标变化 */
  flagChanges: Record<string, string | number | boolean>;
  /** 新埋设的伏笔 */
  foreshadowsPlanted: Foreshadow[];
  /** 已回收的伏笔 ID */
  foreshadowsResolved: EntityId[];
  /** 一句话浓缩（给 AI 的压缩上下文） */
  summary: string;
  /** 关键点列表 */
  keyPoints?: string[];
  /** 标签 */
  tags?: string[];
}
