/**
 * 伏笔 - 回收系统。
 * - 伏笔必须完整登记；写了不回收 = 垃圾脚本。
 * - 状态：open（未回收）/ resolved（已回收）。
 * - 已回收的伏笔可并入人物/世界状态。
 * - 用于全剧本一致性检查（设定冲突、伏笔未回收）。
 */
import type { EntityId } from './ids';

/** 位置引用（伏笔埋设/回收处） */
export interface BeatRef {
  chapterId: EntityId;
  sectionId: EntityId;
  beatId?: EntityId;
}

/** 伏笔 */
export interface Foreshadow {
  id: EntityId;
  /** 伏笔内容 */
  content: string;
  /** 埋设位置 */
  plantedAt: BeatRef | null;
  /** 回收位置 */
  resolvedAt: BeatRef | null;
  status: 'open' | 'resolved';
  /** 回收说明（回收后并入人物/世界状态的描述） */
  resolutionNote?: string;
  tags?: string[];
}
