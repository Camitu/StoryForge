/**
 * 人物设定系统。
 * - 基础人设（信息 + 备注，如 AI 绘画提示词）。
 * - 随时间线/路线更新的「状态补充系统」：CharacterState 记录关系、性格、属性随事件变化。
 */
import type { EntityId } from './ids';

/** 立绘/头像裁剪框（归一化 0~1） */
export interface AvatarCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 表情定义：一个表情绑定一张立绘 + 可选头像裁剪 */
export interface ExpressionDef {
  name: string;
  /** 立绘路径（相对 assets） */
  assetPath: string;
  avatarCrop?: AvatarCrop;
}

/** 站位定义 */
export interface Position {
  id: string;
  name: string;
  /** 百分比坐标 */
  left: number;
  top: number;
}

/** 角色属性（好感度等） */
export interface CharacterAttribute {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: number | string | boolean;
}

/** 角色设定 */
export interface Character {
  id: EntityId;
  name: string;
  /** 备注（含 AI 绘画提示词等） */
  note?: string;
  expressions: ExpressionDef[];
  defaultPositionId?: string;
  avatarCrop?: AvatarCrop;
  /** 属性值（好感度等） */
  attributeValues?: Record<string, number | string | boolean>;
  /** 主题色（编辑器卡片显示） */
  themeColor?: { bg: string; fg: string; ring: string };
}

/**
 * 人物状态快照 —— 叙事状态（WorldState）的核心组成部分。
 * 不同时间线/剧情路线下，人物关系、性格、行为随事件变化。
 * 例：完成事件1后「角色A 对 角色B = 恋爱关系」；完成事件2后则 = 敌对关系。
 */
export interface CharacterState {
  characterId: EntityId;
  /** 关系状态：键 = 对方角色 ID，值 = 关系描述（恋爱/敌对/朋友…） */
  relationStates?: Record<EntityId, string>;
  /** 当前性格/心境快照 */
  traitState?: string;
  /** 属性值快照（好感度等） */
  attributeValues?: Record<string, number | string | boolean>;
  /** 状态生效时间 */
  sinceTime?: string;
}
