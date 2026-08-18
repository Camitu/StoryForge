/**
 * 场景系统（v3，简化）。
 *
 * 场景名称唯一（牵扯到后续素材资产），无则新建，写作时从列表选择。
 */
import type { EntityId } from './ids';

/** 场景 */
export interface Scene {
  id: EntityId;
  /** 场景名称（唯一） */
  name: string;
  /** 备注（可选） */
  note?: string;
}
