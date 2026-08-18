/**
 * 伏笔 - 回收系统（v3）。
 *
 * - 伏笔必须完整登记；写了不回收 = 垃圾脚本。
 * - 状态：open（未回收）/ resolved（已回收）。
 * - 记录埋设位置与回收位置（章节 + 行），便于跳转。
 */
import type { EntityId } from './ids';

/** 位置引用（伏笔埋设/回收处） */
export interface LineRef {
  /** 小章节 ID */
  subChapterId: EntityId;
  /** 行 ID（可选） */
  lineId?: EntityId;
}

/** 伏笔 */
export interface Foreshadow {
  id: EntityId;
  /** 伏笔内容 */
  content: string;
  /** 埋设位置 */
  plantedAt: LineRef;
  /** 埋设日期（冗余，来自小章节 date，便于列表展示） */
  plantedDate?: string;
  status: 'open' | 'resolved';
  /** 回收位置 */
  resolvedAt?: LineRef;
  /** 回收日期（冗余） */
  resolvedDate?: string;
  /** 回收说明（可选） */
  resolutionNote?: string;
}
