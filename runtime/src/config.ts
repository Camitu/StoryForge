import type { Project } from '@storyforge/shared'

/** StoryForge 服务地址 */
export const API_BASE = 'http://127.0.0.1:8790'

/** 默认播放的工程（可用 ?project=xxx 覆盖） */
export const DEFAULT_PROJECT_ID = 'demo-youbao'

/** 资产相对路径 → 完整媒体 URL */
export function mediaUrl(assetPath: string): string {
  const encoded = assetPath.split('/').map(encodeURIComponent).join('/')
  return `${API_BASE}/media/${encoded}`
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`)
  if (!res.ok) throw new Error(`读取工程失败: ${res.status}`)
  return res.json()
}
