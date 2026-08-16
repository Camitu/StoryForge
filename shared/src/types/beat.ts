/**
 * Beat —— 结构化剧本的最小单元（权威存储）。
 *
 * 设计要点：
 * - Galgame 脚本以「结构化 beat」为权威存储；Markdown 只是其「视图」，不作为权威。
 * - 每个 beat 是判别联合（discriminated union），以 `kind` 区分类型。
 * - 「填空式创作」表格的一行，对应 DialogueBeat：
 *   角色姓名 / 表情 / 对白 / 立绘 / 头像 / 场景
 * - 空值继承语义：
 *   - expression 空 = 默认表情
 *   - sprite 空 = 默认立绘
 *   - avatar 空 = 与立绘一致
 *   - sceneId 空 = 与上一 beat 一致
 */
import type { EntityId, StoryTime } from './ids';

/** 资产引用：null 表示继承默认或与上一 beat 一致 */
export type AssetRef = string | null;

/** 表情名：空字符串 = 默认表情 */
export type Expression = string;

/** 所有 beat 共有的字段 */
export interface BeatBase {
  /** beat 唯一 ID（锚点 / 跳转 / 伏笔引用用） */
  id?: EntityId;
}

/** 对白 Beat —— 最核心单元，对应填空式表格的一行 */
export interface DialogueBeat extends BeatBase {
  kind: 'dialogue';
  /** 时间标签 */
  time: StoryTime;
  /** 说话角色 ID */
  characterId: EntityId;
  /** 表情（空 = 默认） */
  expression: Expression;
  /** 对白文本 */
  text: string;
  /** 立绘（空 = 默认立绘） */
  sprite: AssetRef;
  /** 头像（空 = 与立绘一致） */
  avatar: AssetRef;
  /** 场景（空 = 与上一 beat 一致） */
  sceneId: EntityId | null;
  /** CG 图（空 = 无 CG） */
  cg: AssetRef;
  /** 若为锚点 beat，指向锚点 ID（AI 不得修改） */
  anchorId?: EntityId;
}

/** 旁白 Beat —— 无说话人 */
export interface NarrationBeat extends BeatBase {
  kind: 'narration';
  time: StoryTime;
  text: string;
  sceneId?: EntityId | null;
}

/** 切场景 Beat */
export interface SceneBeat extends BeatBase {
  kind: 'scene';
  time: StoryTime;
  sceneId: EntityId;
  transition?: 'cut' | 'fade' | 'cover';
  durationMs?: number;
}

/** 角色立绘/表情变化 Beat */
export interface CharacterBeat extends BeatBase {
  kind: 'character';
  time: StoryTime;
  characterId: EntityId;
  op: 'show' | 'hide' | 'expression';
  expression?: Expression;
  sprite?: AssetRef;
  position?: string;
}

/** 背景音乐 Beat */
export interface BgmBeat extends BeatBase {
  kind: 'bgm';
  time: StoryTime;
  /** 播放或停止 */
  op: 'play' | 'stop';
  /** 音频路径 */
  uri?: string;
  loop?: boolean;
  /** 音量 0~100 */
  volume?: number;
}

/** 音效 Beat */
export interface SfxBeat extends BeatBase {
  kind: 'sfx';
  time: StoryTime;
  uri: string;
  volume?: number;
}

/** 分支选项 */
export interface ChoiceOption {
  text: string;
  /** 跳转目标（节 ID） */
  target: EntityId;
  /** 入线条件（可选，剧情路线系统用） */
  condition?: string;
}

/** 分支选项 Beat */
export interface ChoiceBeat extends BeatBase {
  kind: 'choice';
  time: StoryTime;
  options: ChoiceOption[];
}

/** 跳转 Beat */
export interface JumpBeat extends BeatBase {
  kind: 'jump';
  /** 跳转目标（节 ID） */
  target: EntityId;
}

/** 黑幕 Beat */
export interface CurtainBeat extends BeatBase {
  kind: 'curtain';
  op: 'open' | 'close';
  durationMs?: number;
  color?: string;
}

/** 结束 Beat */
export interface EndBeat extends BeatBase {
  kind: 'end';
  /** 结局 ID（分支结局追踪用） */
  endingId?: EntityId;
}

/** Beat 判别联合 */
export type Beat =
  | DialogueBeat
  | NarrationBeat
  | SceneBeat
  | CharacterBeat
  | BgmBeat
  | SfxBeat
  | ChoiceBeat
  | JumpBeat
  | CurtainBeat
  | EndBeat;

/** 剧情锚点：固定内容，除非人工要求，AI 不得修改 */
export interface Anchor {
  id: EntityId;
  /** 锚定到哪个 beat */
  beatId: EntityId;
  kind: 'dialogue' | 'plot-point' | 'foreshadow' | 'ending';
  note?: string;
}
