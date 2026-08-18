import type { Chapter, Character, Foreshadow, Project, Scene, ScriptLine, SubChapter, SubFragment } from '@storyforge/shared'

/** StoryForge 服务地址 */
export const API_BASE = 'http://127.0.0.1:8790'

// ---------- 工程 ----------

export interface ProjectSummary {
  id: string
  name: string
  version: string
  storageDir?: string
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

export async function createProject(name: string, storageDir?: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, storageDir }),
  })
  if (!res.ok) throw new Error(`创建工程失败: ${res.status}`)
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

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除工程失败: ${res.status}`)
}

// ---------- 世界观 ----------

export async function getWorldview(pid: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/worldview`)
  if (!res.ok) throw new Error(`读取世界观失败: ${res.status}`)
  const d = await res.json()
  return d.worldview ?? ''
}

export async function putWorldview(pid: string, worldview: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/worldview`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ worldview }),
  })
  if (!res.ok) throw new Error(`保存世界观失败: ${res.status}`)
}

// ---------- 人设 ----------

export async function listCharacters(pid: string): Promise<Character[]> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/characters`)
  if (!res.ok) throw new Error(`读取人设失败: ${res.status}`)
  return res.json()
}

export async function createCharacter(pid: string, data: Partial<Character>): Promise<Character> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/characters`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`新建角色失败: ${res.status}`)
  return res.json()
}

export async function updateCharacter(pid: string, cid: string, data: Partial<Character>): Promise<Character> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/characters/${cid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`保存角色失败: ${res.status}`)
  return res.json()
}

export async function deleteCharacter(pid: string, cid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/characters/${cid}`, { method: 'DELETE' })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.detail ?? `删除角色失败: ${res.status}`)
  }
}

export async function characterRefs(pid: string, cid: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/characters/${cid}/refs`)
  if (!res.ok) throw new Error(`检查引用失败: ${res.status}`)
  const d = await res.json()
  return d.refs ?? []
}

// ---------- 场景 ----------

export async function listScenes(pid: string): Promise<Scene[]> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/scenes`)
  if (!res.ok) throw new Error(`读取场景失败: ${res.status}`)
  return res.json()
}

export async function createScene(pid: string, name: string, note?: string): Promise<Scene> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/scenes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, note }),
  })
  if (!res.ok) throw new Error(`新建场景失败: ${res.status}`)
  return res.json()
}

export async function updateScene(pid: string, sid: string, name: string, note?: string): Promise<Scene> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/scenes/${sid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, note }),
  })
  if (!res.ok) throw new Error(`保存场景失败: ${res.status}`)
  return res.json()
}

export async function deleteScene(pid: string, sid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/scenes/${sid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除场景失败: ${res.status}`)
}

// ---------- 大章节 / 小章节 ----------

export async function listChapters(pid: string): Promise<Chapter[]> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/chapters`)
  if (!res.ok) throw new Error(`读取章节失败: ${res.status}`)
  return res.json()
}

export async function createChapter(pid: string, name: string, summary?: string): Promise<Chapter> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/chapters`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, summary }),
  })
  if (!res.ok) throw new Error(`新建大章节失败: ${res.status}`)
  return res.json()
}

export async function updateChapter(pid: string, cid: string, name: string, summary?: string): Promise<Chapter> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/chapters/${cid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, summary }),
  })
  if (!res.ok) throw new Error(`保存大章节失败: ${res.status}`)
  return res.json()
}

export async function deleteChapter(pid: string, cid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/chapters/${cid}`, { method: 'DELETE' })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.detail ?? `删除大章节失败: ${res.status}`)
  }
}

export async function moveChapter(pid: string, cid: string, delta: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/chapters/${cid}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }),
  })
  if (!res.ok) throw new Error(`移动大章节失败: ${res.status}`)
}

export interface SubChapterIn {
  name: string
  date?: string
  summary?: string
  tags?: string[]
  condense?: string
  mode?: 'standard' | 'free'
  freeText?: string
}

export async function createSubChapter(pid: string, chapterId: string, data: SubChapterIn): Promise<SubChapter> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/chapters/${chapterId}/subchapters`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.detail ?? `新建小章节失败: ${res.status}`)
  }
  return res.json()
}

export async function getSubChapter(pid: string, sid: string): Promise<SubChapter> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}`)
  if (!res.ok) throw new Error(`读取小章节失败: ${res.status}`)
  return res.json()
}

export async function updateSubChapter(pid: string, sid: string, data: SubChapterIn): Promise<SubChapter> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.detail ?? `保存小章节失败: ${res.status}`)
  }
  return res.json()
}

export async function deleteSubChapter(pid: string, sid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除小章节失败: ${res.status}`)
}

export async function moveSubChapter(pid: string, sid: string, delta?: number, chapterId?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(delta !== undefined ? { delta } : { chapterId }),
  })
  if (!res.ok) throw new Error(`移动小章节失败: ${res.status}`)
}

// ---------- 标准写作行 ----------

export interface LineIn {
  kind: 'dialogue' | 'narration' | 'scene'
  characterId?: string
  characterName?: string
  expression?: string
  text?: string
  sceneId?: string
  sceneName?: string
}

export async function addLine(pid: string, sid: string, data: LineIn): Promise<ScriptLine> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/lines`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`新增行失败: ${res.status}`)
  return res.json()
}

export async function updateLine(pid: string, sid: string, lid: string, data: LineIn): Promise<ScriptLine> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/lines/${lid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`保存行失败: ${res.status}`)
  return res.json()
}

export async function deleteLine(pid: string, sid: string, lid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/lines/${lid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除行失败: ${res.status}`)
}

export async function moveLine(pid: string, sid: string, lid: string, delta: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/lines/${lid}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }),
  })
  if (!res.ok) throw new Error(`移动行失败: ${res.status}`)
}

// ---------- 子片段（章节内 fragment） ----------

export async function addFragment(pid: string, sid: string, name: string): Promise<SubFragment> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.detail ?? `新建子片段失败: ${res.status}`)
  }
  return res.json()
}

export async function updateFragment(pid: string, sid: string, fid: string, data: { name?: string; freeText?: string }): Promise<SubFragment> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments/${fid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`更新子片段失败: ${res.status}`)
  return res.json()
}

export async function deleteFragment(pid: string, sid: string, fid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments/${fid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除子片段失败: ${res.status}`)
}

export async function addFragmentLine(pid: string, sid: string, fid: string, data: LineIn): Promise<ScriptLine> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments/${fid}/lines`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`新增片段行失败: ${res.status}`)
  return res.json()
}

export async function updateFragmentLine(pid: string, sid: string, fid: string, lid: string, data: LineIn): Promise<ScriptLine> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments/${fid}/lines/${lid}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`保存片段行失败: ${res.status}`)
  return res.json()
}

export async function deleteFragmentLine(pid: string, sid: string, fid: string, lid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments/${fid}/lines/${lid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除片段行失败: ${res.status}`)
}

export async function moveFragmentLine(pid: string, sid: string, fid: string, lid: string, delta: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/subchapters/${sid}/fragments/${fid}/lines/${lid}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }),
  })
  if (!res.ok) throw new Error(`移动片段行失败: ${res.status}`)
}

// ---------- 伏笔 ----------

export interface ForeshadowIn {
  content: string
  subChapterId: string
  lineId?: string
}

export async function listForeshadows(pid: string): Promise<Foreshadow[]> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/foreshadows`)
  if (!res.ok) throw new Error(`读取伏笔失败: ${res.status}`)
  return res.json()
}

export async function createForeshadow(pid: string, data: ForeshadowIn): Promise<Foreshadow> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/foreshadows`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`新建伏笔失败: ${res.status}`)
  return res.json()
}

export async function resolveForeshadow(pid: string, fid: string, data: { subChapterId: string; lineId?: string; note?: string }): Promise<Foreshadow> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/foreshadows/${fid}/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`回收伏笔失败: ${res.status}`)
  return res.json()
}

export async function reopenForeshadow(pid: string, fid: string): Promise<Foreshadow> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/foreshadows/${fid}/reopen`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`重新打开伏笔失败: ${res.status}`)
  return res.json()
}

export async function deleteForeshadow(pid: string, fid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/foreshadows/${fid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`删除伏笔失败: ${res.status}`)
}

// ---------- 搜索 ----------

export interface SearchResult {
  subChapterId: string
  chapterName: string
  subChapterName: string
  date: string
  /** 命中位于某个子片段时，返回该片段 id（跳转用） */
  fragmentId?: string | null
  hits: string[]
}

export async function search(pid: string, q: string): Promise<SearchResult[]> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error(`搜索失败: ${res.status}`)
  return res.json()
}

// ---------- 图片上传 / 媒体 ----------

export async function uploadImage(pid: string, file: File): Promise<{ path: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/projects/${pid}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`上传失败: ${res.status}`)
  return res.json()
}

export function mediaUrl(pid: string, path: string): string {
  return `${API_BASE}/api/projects/${pid}/media?path=${encodeURIComponent(path)}`
}

// ---------- LetsGal 同步 ----------

export interface SyncStatus {
  bound: boolean
  letsgalDir?: string
  chapters?: number
  characters?: number
  scenes?: number
  chapterNames?: string[]
}

export interface SyncResult {
  dry_run: boolean
  stats?: { updated: number; added: number; skipped_effect_blocks: number }
  chapters?: { chapterId: string; file: string; blocks: number; updated: number; added: number }[]
  pendingCharacters?: { name: string }[]
  pendingScenes?: { name: string }[]
  pendingManifest?: { path: string }[]
}

export async function bindLetsGal(projectId: string, letsgalDir: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/sync/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ letsgalDir }),
  })
  if (!res.ok) throw new Error(`绑定失败: ${res.status}`)
  return res.json()
}

export async function getSyncStatus(projectId: string): Promise<SyncStatus> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/sync/status`)
  if (!res.ok) throw new Error(`读取同步状态失败: ${res.status}`)
  return res.json()
}

export async function syncExport(projectId: string, dryRun: boolean): Promise<SyncResult> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/sync/export?dry_run=${dryRun}`, { method: 'POST' })
  if (!res.ok) throw new Error(`同步导出失败: ${res.status}`)
  return res.json()
}

export async function syncImport(projectId: string, dryRun: boolean): Promise<SyncResult> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/sync/import?dry_run=${dryRun}`, { method: 'POST' })
  if (!res.ok) throw new Error(`反向同步失败: ${res.status}`)
  return res.json()
}

// ---------- 一致性检查 ----------

export async function checkProject(pid: string): Promise<{ ok: boolean; issue_count: number; issues: string[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${pid}/check`)
  if (!res.ok) throw new Error(`检查失败: ${res.status}`)
  return res.json()
}
