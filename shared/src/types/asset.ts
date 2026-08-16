/**
 * 资产库系统。
 * - 图片绑定到角色立绘/头像/场景/UI；音频绑定 BGM/音效。
 * - 引用计数：被引用但为空的素材 = 待创作清单。
 * - 支持完整深度复制（同一角色/场景复用于不同脚本）。
 */
import type { EntityId } from './ids';

/** 资产类型 */
export type AssetType = 'sprite' | 'avatar' | 'cg' | 'background' | 'bgm' | 'sfx' | 'ui';

/** 资产绑定关系 */
export interface AssetBinding {
  /** 绑定到的实体类型（character/scene/...） */
  entityType: string;
  entityId: EntityId;
  /** 绑定角色（立绘/头像/CG…） */
  role: string;
}

/** 资产 */
export interface Asset {
  id: EntityId;
  type: AssetType;
  /** 文件路径（相对 assets 根） */
  path: string;
  /** 绑定关系 */
  bindings?: AssetBinding[];
  /** 引用计数（冗余缓存，可由 bindings 派生） */
  refCount?: number;
  /** 是否已生成素材（false = 待创作） */
  ready: boolean;
}
