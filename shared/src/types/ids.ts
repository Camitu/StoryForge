/**
 * 基础标识与标量类型。
 * 所有实体（章节/节/角色/场景/伏笔/资产…）统一使用 UUID 字符串作为 ID。
 */

/** 实体 ID：UUID 字符串 */
export type EntityId = string;

/**
 * 故事时间标签。
 * 用于时间线系统校验，避免章节故事发生错乱。
 * 例："7月8日"、"7月8日 上午"、"第三天"、"序章"。
 */
export type StoryTime = string;
