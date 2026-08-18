/**
 * 标准写作行（v3）—— 小章节内的剧情行。
 *
 * 只保留写作层需要的能力：
 * - dialogue：角色对白（角色/表情/文本/场景）
 * - narration：旁白（文本/场景）
 * - scene：切场景（场景）
 *
 * 演出类（BGM/SFX/黑幕/跳转/分支/立绘动画等）不在这里——那是 LetsGal 演出层的事。
 */
import type { EntityId } from './ids';

/** 标准写作行 */
export type ScriptLineKind = 'dialogue' | 'narration' | 'scene';

/** 外部演出块（来自 LetsGal 的特效/分支等，StoryForge 只读占位展示，编辑仍在 LetsGal） */
export interface ExternalBlock {
  id: EntityId;
  /** LetsGal block type：branch / particle / sound / curtain / floatingText / camera … */
  type: string;
  /** 展示描述（如「分支选项：选择片段1 / 选择片段2」） */
  label: string;
  /** 该演出块前面的文本行数量（定位在行列表中的展示位置） */
  afterLineIndex: number;
}

export interface ScriptLineBase {
  id: EntityId;
  kind: ScriptLineKind;
}

/** 对白行 */
export interface DialogueLine extends ScriptLineBase {
  kind: 'dialogue';
  /** 角色 ID（空 = 旁白，正常不会为空；旁白用 narration） */
  characterId: EntityId;
  /** 角色名（冗余，方便显示与同步） */
  characterName?: string;
  /** 表情（空 = 默认表情） */
  expression?: string;
  /** 对白文本 */
  text: string;
  /** 场景（空 = 延续上一行） */
  sceneId?: EntityId | null;
  sceneName?: string;
}

/** 旁白行 */
export interface NarrationLine extends ScriptLineBase {
  kind: 'narration';
  text: string;
  sceneId?: EntityId | null;
  sceneName?: string;
}

/** 切场景行 */
export interface SceneLine extends ScriptLineBase {
  kind: 'scene';
  sceneId: EntityId;
  sceneName?: string;
}

/** 标准写作行（判别联合） */
export type ScriptLine = DialogueLine | NarrationLine | SceneLine;

/** 章节内片段（子片段）—— 对应 LetsGal 章节内的 fragment。
 *
 * 每个小章节至少有一个 main 片段（小章节自身 lines 即 main 内容），
 * 子片段是额外命名的片段，可被 LetsGal 的 callFragment / branch 调用。
 */
export interface SubFragment {
  id: EntityId;
  /** 片段名（LetsGal fragment name，main 为保留名） */
  name: string;
  /** 片段内容行 */
  lines: ScriptLine[];
  /** 外部演出块占位（LetsGal 特效/分支等，只读展示） */
  externalBlocks?: ExternalBlock[];
  /** 片段自由写作（Markdown 草稿，不同步 LetsGal） */
  freeText?: string;
}
