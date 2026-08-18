/**
 * 人设系统（v3）。
 *
 * - 角色卡片：姓名 + 备注 + 基本设定（文本）+ 形象图 + 剧情设定（随时间线变化）。
 * - 剧情设定：一行一个时间点（date + content），点击日期可跳转到对应剧情时间线。
 */
import type { EntityId, StoryDate } from './ids';

/** 剧情设定点：某一时间点角色发生的变化 */
export interface CharacterTimelinePoint {
  date: StoryDate;
  content: string;
}

/** 角色（人设） */
export interface Character {
  id: EntityId;
  name: string;
  /** 备注（一句话定位，如「男主角」） */
  note?: string;
  /** 基本设定（自由文本，如年龄/性格/背景） */
  baseSetting?: string;
  /** 形象图路径（可选） */
  imagePath?: string;
  /** 剧情设定（随时间线变化，一行一个时间点） */
  plotTimeline?: CharacterTimelinePoint[];
}
