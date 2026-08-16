/**
 * 场景系统：场景 = 多层视差图层（每层带 depth）。
 */
import type { EntityId } from './ids';

/** 场景图层 */
export interface SceneLayer {
  id: EntityId;
  name: string;
  /** 图片路径（相对 assets） */
  assetPath: string;
  /** 视差深度：越小越远（远景层 depth 大，前景层 depth 小） */
  distance: number;
}

/** 场景 */
export interface Scene {
  id: EntityId;
  name: string;
  layers: SceneLayer[];
}
