import type { Project } from '@storyforge/shared'

/** StoryForge 服务地址 */
export const API_BASE = 'http://127.0.0.1:8790'

/** 把资产相对路径（如 sprites/xxx/yyy.png）转成完整媒体 URL */
export function mediaUrl(assetPath: string): string {
  const encoded = assetPath.split('/').map(encodeURIComponent).join('/')
  return `${API_BASE}/media/${encoded}`
}

export interface ProjectSummary {
  id: string
  name: string
  version: string
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/api/projects`)
  if (!res.ok) throw new Error(`列出工程失败: ${res.status}`)
  return res.json()
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`)
  if (!res.ok) throw new Error(`读取工程失败: ${res.status}`)
  return res.json()
}

export async function saveProject(project: Project): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${project.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  })
  if (!res.ok) throw new Error(`保存工程失败: ${res.status}`)
  return res.json()
}
