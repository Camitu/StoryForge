import { create } from 'zustand'
import type { Chapter, Character, Foreshadow, Project, Scene } from '@storyforge/shared'
import {
  addFragment as addFragmentApi,
  addFragmentLine as addFragmentLineApi,
  checkProject,
  createChapter,
  createCharacter,
  createForeshadow,
  createProject,
  createScene,
  createSubChapter,
  deleteChapter,
  deleteCharacter,
  deleteForeshadow,
  deleteFragment as deleteFragmentApi,
  deleteFragmentLine as deleteFragmentLineApi,
  deleteLine,
  deleteScene,
  deleteSubChapter,
  getProject,
  getSyncStatus,
  listCharacters,
  listChapters,
  listForeshadows,
  listProjects,
  listScenes,
  moveChapter,
  moveFragmentLine as moveFragmentLineApi,
  moveLine,
  moveSubChapter,
  reopenForeshadow,
  resolveForeshadow,
  saveProject,
  search,
  syncExport,
  syncImport,
  updateChapter,
  updateCharacter,
  updateFragmentLine as updateFragmentLineApi,
  updateFragment as updateFragmentApi,
  updateLine,
  updateScene,
  updateSubChapter,
  type LineIn,
  type ProjectSummary,
  type SearchResult,
  type SubChapterIn,
  type SyncResult,
  type SyncStatus,
} from './api'

export type TabId = 'world' | 'writing' | 'foreshadow' | 'timeline' | 'sync'

/** 写作类型：标准写作（结构化行）或自由写作（Markdown 草稿）；编辑/预览由 preview 控制 */
export type ViewMode = 'standard' | 'free'

interface EditorState {
  // 项目选择
  projects: ProjectSummary[]
  currentProjectId: string | null
  // 当前项目数据（缓存）
  project: Project | null
  characters: Character[]
  scenes: Scene[]
  chapters: Chapter[]
  foreshadows: Foreshadow[]
  // UI
  tab: TabId
  selectedSubId: string | null
  viewMode: ViewMode
  /** 预览模式（编辑/预览切换）：标准=只读行，自由=Markdown 渲染 */
  preview: boolean
  /** 全局保存信号（工具栏保存按钮触发，编辑器监听后保存当前内容） */
  saveSignal: number
  timelineVisible: boolean
  collapsedChapters: Set<string>
  searchResults: SearchResult[]
  syncStatus: SyncStatus | null
  syncResult: SyncResult | null
  syncing: boolean
  saving: boolean
  error: string | null
  clearError: () => void

  // actions
  refreshProjects: () => Promise<void>
  openProject: (id: string) => Promise<void>
  createNewProject: (name: string, storageDir?: string) => Promise<void>
  closeProject: () => void
  setTab: (t: TabId) => void
  setSelectedSub: (id: string | null) => void
  setViewMode: (m: ViewMode) => void
  setPreview: (p: boolean) => void
  requestSave: () => void
  toggleTimeline: () => void
  toggleChapterCollapse: (cid: string) => void
  rememberSub: (id: string) => void

  loadWorld: () => Promise<void>
  saveWorld: (worldview: string) => Promise<void>
  loadCharacters: () => Promise<void>
  saveCharacter: (cid: string, data: Partial<Character>) => Promise<void>
  addCharacter: (data: Partial<Character>) => Promise<void>
  removeCharacter: (cid: string) => Promise<void>
  loadScenes: () => Promise<void>
  saveScene: (sid: string, name: string, note?: string) => Promise<void>
  addScene: (name: string, note?: string) => Promise<void>
  removeScene: (sid: string) => Promise<void>
  loadChapters: () => Promise<void>
  addChapter: (name: string, summary?: string) => Promise<void>
  saveChapter: (cid: string, name: string, summary?: string) => Promise<void>
  removeChapter: (cid: string) => Promise<void>
  shiftChapter: (cid: string, delta: number) => Promise<void>
  addSub: (chapterId: string, data: SubChapterIn) => Promise<void>
  saveSub: (sid: string, data: SubChapterIn) => Promise<void>
  removeSub: (sid: string) => Promise<void>
  shiftSub: (sid: string, delta: number, chapterId?: string) => Promise<void>
  addLine: (sid: string, data: LineIn) => Promise<void>
  editLine: (sid: string, lid: string, data: LineIn) => Promise<void>
  removeLine: (sid: string, lid: string) => Promise<void>
  shiftLine: (sid: string, lid: string, delta: number) => Promise<void>
  addFragment: (sid: string, name: string) => Promise<void>
  renameFragment: (sid: string, fid: string, name: string) => Promise<void>
  saveFragmentFreeText: (sid: string, fid: string, freeText: string) => Promise<void>
  removeFragment: (sid: string, fid: string) => Promise<void>
  addFragmentLine: (sid: string, fid: string, data: LineIn) => Promise<void>
  editFragmentLine: (sid: string, fid: string, lid: string, data: LineIn) => Promise<void>
  removeFragmentLine: (sid: string, fid: string, lid: string) => Promise<void>
  shiftFragmentLine: (sid: string, fid: string, lid: string, delta: number) => Promise<void>
  loadForeshadows: () => Promise<void>
  addForeshadow: (content: string, subChapterId: string, lineId?: string) => Promise<void>
  markForeshadow: (fid: string, subChapterId: string, lineId?: string, note?: string) => Promise<void>
  unmarkForeshadow: (fid: string) => Promise<void>
  removeForeshadow: (fid: string) => Promise<void>
  runSearch: (q: string) => Promise<void>
  runCheck: () => Promise<{ ok: boolean; issues: string[] }>
  refreshSync: () => Promise<void>
  bindLetsGal: (dir: string) => Promise<void>
  runExport: (dryRun: boolean) => Promise<void>
  runImport: (dryRun: boolean) => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  project: null,
  characters: [],
  scenes: [],
  chapters: [],
  foreshadows: [],
  tab: 'writing',
  selectedSubId: null,
  viewMode: 'standard',
  preview: false,
  saveSignal: 0,
  timelineVisible: true,
  collapsedChapters: new Set<string>(),
  searchResults: [],
  syncStatus: null,
  syncResult: null,
  syncing: false,
  saving: false,
  error: null,

  refreshProjects: async () => {
    try {
      const projects = await listProjects()
      set({ projects, error: null })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  openProject: async (id) => {
    try {
      const project = await getProject(id)
      set({ project, currentProjectId: id, selectedSubId: null, searchResults: [], error: null })
      await Promise.all([
        get().loadCharacters(),
        get().loadScenes(),
        get().loadChapters(),
        get().loadForeshadows(),
        get().refreshSync(),
      ])
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  createNewProject: async (name, storageDir) => {
    try {
      const project = await createProject(name, storageDir)
      await get().refreshProjects()
      await get().openProject(project.id)
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  closeProject: () => set({ project: null, currentProjectId: null, selectedSubId: null }),

  setTab: (tab) => set({ tab }),
  clearError: () => set({ error: null }),
  setViewMode: (viewMode) => set({ viewMode }),
  setPreview: (preview) => set({ preview }),
  requestSave: () => set((s) => ({ saveSignal: s.saveSignal + 1 })),
  toggleTimeline: () => set({ timelineVisible: !get().timelineVisible }),
  toggleChapterCollapse: (cid) => {
    const next = new Set(get().collapsedChapters)
    if (next.has(cid)) next.delete(cid)
    else next.add(cid)
    set({ collapsedChapters: next })
  },
  rememberSub: (id) => {
    try {
      const pid = get().currentProjectId
      if (pid) localStorage.setItem(`sf_last_sub_${pid}`, id)
    } catch { /* ignore */ }
  },
  setSelectedSub: (selectedSubId) => set({ selectedSubId }),

  loadWorld: async () => {},
  saveWorld: async (worldview) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const res = await fetch(`http://127.0.0.1:8790/api/projects/${pid}/worldview`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ worldview }),
      })
      if (!res.ok) throw new Error(`保存世界观失败: ${res.status}`)
      set({ project: { ...(get().project as Project), worldview } })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadCharacters: async () => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const characters = await listCharacters(pid)
      set({ characters })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveCharacter: async (cid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateCharacter(pid, cid, data)
      set({ characters: get().characters.map((c) => (c.id === cid ? updated : c)) })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addCharacter: async (data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const created = await createCharacter(pid, data)
      set({ characters: [...get().characters, created] })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeCharacter: async (cid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteCharacter(pid, cid)
      set({ characters: get().characters.filter((c) => c.id !== cid) })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadScenes: async () => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const scenes = await listScenes(pid)
      set({ scenes })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveScene: async (sid, name, note) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateScene(pid, sid, name, note)
      set({ scenes: get().scenes.map((s) => (s.id === sid ? updated : s)) })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addScene: async (name, note) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const created = await createScene(pid, name, note)
      set({ scenes: [...get().scenes, created] })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeScene: async (sid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteScene(pid, sid)
      set({ scenes: get().scenes.filter((s) => s.id !== sid) })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadChapters: async () => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const chapters = await listChapters(pid)
      set({ chapters })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addChapter: async (name, summary) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await createChapter(pid, name, summary)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveChapter: async (cid, name, summary) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateChapter(pid, cid, name, summary)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeChapter: async (cid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteChapter(pid, cid)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  shiftChapter: async (cid, delta) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveChapter(pid, cid, delta)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addSub: async (chapterId, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const sub = await createSubChapter(pid, chapterId, data)
      await get().loadChapters()
      set({ selectedSubId: sub.id })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveSub: async (sid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateSubChapter(pid, sid, data)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeSub: async (sid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteSubChapter(pid, sid)
      await get().loadChapters()
      if (get().selectedSubId === sid) set({ selectedSubId: null })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  shiftSub: async (sid, delta, chapterId) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveSubChapter(pid, sid, delta, chapterId)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addLine: async (sid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const res = await fetch(`http://127.0.0.1:8790/api/projects/${pid}/subchapters/${sid}/lines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`新增行失败: ${res.status}`)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  editLine: async (sid, lid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateLine(pid, sid, lid, data)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeLine: async (sid, lid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteLine(pid, sid, lid)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  shiftLine: async (sid, lid, delta) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveLine(pid, sid, lid, delta)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addFragment: async (sid, name) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await addFragmentApi(pid, sid, name)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  renameFragment: async (sid, fid, name) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateFragmentApi(pid, sid, fid, { name })
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveFragmentFreeText: async (sid, fid, freeText) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateFragmentApi(pid, sid, fid, { freeText })
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeFragment: async (sid, fid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteFragmentApi(pid, sid, fid)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addFragmentLine: async (sid, fid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await addFragmentLineApi(pid, sid, fid, data)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  editFragmentLine: async (sid, fid, lid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateFragmentLineApi(pid, sid, fid, lid, data)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeFragmentLine: async (sid, fid, lid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteFragmentLineApi(pid, sid, fid, lid)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  shiftFragmentLine: async (sid, fid, lid, delta) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveFragmentLineApi(pid, sid, fid, lid, delta)
      await get().loadChapters()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadForeshadows: async () => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const foreshadows = await listForeshadows(pid)
      set({ foreshadows })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addForeshadow: async (content, subChapterId, lineId) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await createForeshadow(pid, { content, subChapterId, lineId })
      await get().loadForeshadows()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  markForeshadow: async (fid, subChapterId, lineId, note) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await resolveForeshadow(pid, fid, { subChapterId, lineId, note })
      await get().loadForeshadows()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  unmarkForeshadow: async (fid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await reopenForeshadow(pid, fid)
      await get().loadForeshadows()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeForeshadow: async (fid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteForeshadow(pid, fid)
      await get().loadForeshadows()
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  runSearch: async (q) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const searchResults = await search(pid, q)
      set({ searchResults })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  runCheck: async () => {
    const pid = get().currentProjectId
    if (!pid) return { ok: true, issues: [] }
    try {
      return await checkProject(pid)
    } catch (e) {
      set({ error: (e as Error).message })
      return { ok: false, issues: [(e as Error).message] }
    }
  },

  refreshSync: async () => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const syncStatus = await getSyncStatus(pid)
      set({ syncStatus })
    } catch {
      set({ syncStatus: null })
    }
  },

  bindLetsGal: async (dir) => {
    const pid = get().currentProjectId
    if (!pid) return
    set({ syncing: true, error: null })
    try {
      const res = await fetch(`http://127.0.0.1:8790/api/projects/${pid}/sync/bind`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ letsgalDir: dir }),
      })
      if (!res.ok) throw new Error(`绑定失败: ${res.status}`)
      await get().refreshSync()
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ syncing: false })
    }
  },

  runExport: async (dryRun) => {
    const pid = get().currentProjectId
    if (!pid) return
    set({ syncing: true, error: null })
    try {
      const syncResult = await syncExport(pid, dryRun)
      set({ syncResult })
      await get().refreshSync()
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ syncing: false })
    }
  },

  runImport: async (dryRun) => {
    const pid = get().currentProjectId
    if (!pid) return
    set({ syncing: true, error: null })
    try {
      const syncResult = await syncImport(pid, dryRun)
      set({ syncResult })
      if (!dryRun) {
        await Promise.all([get().loadChapters(), get().loadCharacters(), get().loadScenes(), get().loadForeshadows()])
      }
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ syncing: false })
    }
  },
}))

// 保存按钮（全量保存）—— 编辑器本地编辑后保存
export async function saveCurrentProject(): Promise<void> {
  const s = useEditorStore.getState()
  if (!s.project) return
  const { saving, error } = s
  void saving
  void error
  useEditorStore.setState({ saving: true, error: null })
  try {
    await saveProject(s.project)
  } catch (e) {
    useEditorStore.setState({ error: (e as Error).message })
  } finally {
    useEditorStore.setState({ saving: false })
  }
}
