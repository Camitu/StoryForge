import { create } from 'zustand'
import type { Chapter, Character, Foreshadow, Project, Scene, SubChapter } from '@storyforge/shared'
import {
  addFragment as addFragmentApi,
  addFragmentLine as addFragmentLineApi,
  addLine as addLineApi,
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

/** 章节树本地更新助手：对指定小章节应用 mutator（返回新小章节），其余原样保留 */
function patchSub(chapters: Chapter[], subId: string, mutator: (sub: SubChapter) => SubChapter): Chapter[] {
  return chapters.map((ch) => ({
    ...ch,
    subChapters: ch.subChapters.map((s) => (s.id === subId ? mutator(s) : s)),
  }))
}

/**
 * 操作失败统一处理：
 * - 404：目标（行/小章节）已被删除（删除或切换章节与自动保存的竞态），属正常情况 → 静默重载对齐，不打扰用户
 * - 其他错误：显示 error banner 并重载对齐
 */
function opFail(e: unknown): void {
  const msg = (e as Error).message
  void useEditorStore.getState().loadChapters()
  if (!/404/.test(msg)) {
    useEditorStore.setState({ error: msg })
  }
}

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
  saveScene: (sid: string, name: string, note?: string, imagePath?: string) => Promise<void>
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
  clearSearch: () => void
  runCheck: () => Promise<{ ok: boolean; issues: string[] }>
  refreshSync: () => Promise<void>
  bindLetsGal: (dir: string) => Promise<void>
  runExport: (dryRun: boolean) => Promise<void>
  runImport: (dryRun: boolean) => Promise<void>
  /** 新插入行后需要聚焦的行 id（LineRow 聚焦后自行清空） */
  focusLineId: string | null
  setFocusLine: (id: string | null) => void
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
  focusLineId: null,
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
      set({ project, currentProjectId: id, selectedSubId: null, searchResults: [], focusLineId: null, error: null })
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
  setFocusLine: (focusLineId) => set({ focusLineId }),
  clearSearch: () => set({ searchResults: [] }),

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

  saveScene: async (sid, name, note, imagePath) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateScene(pid, sid, name, note, imagePath)
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
      const chapter = await createChapter(pid, name, summary)
      set({ chapters: [...get().chapters, chapter] })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveChapter: async (cid, name, summary) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateChapter(pid, cid, name, summary)
      set({ chapters: get().chapters.map((c) => (c.id === cid ? updated : c)) })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  removeChapter: async (cid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteChapter(pid, cid)
      set({ chapters: get().chapters.filter((c) => c.id !== cid) })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  shiftChapter: async (cid, delta) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveChapter(pid, cid, delta)
      const chapters = get().chapters
      const idx = chapters.findIndex((c) => c.id === cid)
      const j = idx + delta
      if (idx < 0 || j < 0 || j >= chapters.length) return
      const arr = [...chapters]
      ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
      set({ chapters: arr })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  addSub: async (chapterId, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const sub = await createSubChapter(pid, chapterId, data)
      set({
        chapters: get().chapters.map((ch) => (ch.id === chapterId ? { ...ch, subChapters: [...ch.subChapters, sub] } : ch)),
        selectedSubId: sub.id,
      })
      get().rememberSub(sub.id)
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveSub: async (sid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateSubChapter(pid, sid, data)
      set({ chapters: patchSub(get().chapters, sid, () => updated) })
    } catch (e) {
      opFail(e)
    }
  },

  removeSub: async (sid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteSubChapter(pid, sid)
      set({
        chapters: get().chapters.map((ch) => ({ ...ch, subChapters: ch.subChapters.filter((s) => s.id !== sid) })),
      })
      if (get().selectedSubId === sid) set({ selectedSubId: null })
    } catch (e) {
      opFail(e)
    }
  },

  shiftSub: async (sid, delta, chapterId) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveSubChapter(pid, sid, delta, chapterId)
      const chapters = get().chapters
      if (chapterId) {
        // 跨大章节：移到目标章节末尾
        let moved: SubChapter | null = null
        const next = chapters.map((ch) => {
          const idx = ch.subChapters.findIndex((s) => s.id === sid)
          if (idx < 0) return ch
          moved = ch.subChapters[idx]
          return { ...ch, subChapters: ch.subChapters.filter((s) => s.id !== sid) }
        })
        if (moved) {
          set({ chapters: next.map((ch) => (ch.id === chapterId ? { ...ch, subChapters: [...ch.subChapters, moved!] } : ch)) })
        }
      } else {
        set({
          chapters: chapters.map((ch) => {
            const idx = ch.subChapters.findIndex((s) => s.id === sid)
            if (idx < 0) return ch
            const j = idx + (delta ?? 0)
            if (j < 0 || j >= ch.subChapters.length) return ch
            const arr = [...ch.subChapters]
            ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
            return { ...ch, subChapters: arr }
          }),
        })
      }
    } catch (e) {
      opFail(e)
    }
  },

  addLine: async (sid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const created = await addLineApi(pid, sid, data)
      const afterId = data.afterId
      set({
        chapters: patchSub(get().chapters, sid, (sub) => {
          if (afterId) {
            const idx = sub.lines.findIndex((l) => l.id === afterId)
            if (idx >= 0) {
              return { ...sub, lines: [...sub.lines.slice(0, idx + 1), created, ...sub.lines.slice(idx + 1)] }
            }
          }
          return { ...sub, lines: [...sub.lines, created] }
        }),
        focusLineId: created.id,
      })
    } catch (e) {
      opFail(e)
    }
  },

  editLine: async (sid, lid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateLine(pid, sid, lid, data)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          lines: sub.lines.map((l) => (l.id === lid ? updated : l)),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  removeLine: async (sid, lid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteLine(pid, sid, lid)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          lines: sub.lines.filter((l) => l.id !== lid),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  shiftLine: async (sid, lid, delta) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveLine(pid, sid, lid, delta)
      const chapters = get().chapters
      set({
        chapters: patchSub(chapters, sid, (sub) => {
          const arr = [...sub.lines]
          const idx = arr.findIndex((l) => l.id === lid)
          if (idx < 0) return sub
          const j = idx + delta
          if (j < 0 || j >= arr.length) return sub
          ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
          return { ...sub, lines: arr }
        }),
      })
    } catch (e) {
      opFail(e)
    }
  },

  addFragment: async (sid, name) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const frag = await addFragmentApi(pid, sid, name)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({ ...sub, fragments: [...sub.fragments, frag] })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  renameFragment: async (sid, fid, name) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await updateFragmentApi(pid, sid, fid, { name })
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.map((f) => (f.id === fid ? { ...f, name } : f)),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  saveFragmentFreeText: async (sid, fid, freeText) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateFragmentApi(pid, sid, fid, { freeText })
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.map((f) => (f.id === fid ? updated : f)),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  removeFragment: async (sid, fid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteFragmentApi(pid, sid, fid)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.filter((f) => f.id !== fid),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  addFragmentLine: async (sid, fid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const created = await addFragmentLineApi(pid, sid, fid, data)
      const afterId = data.afterId
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.map((f) => {
            if (f.id !== fid) return f
            if (afterId) {
              const idx = f.lines.findIndex((l) => l.id === afterId)
              if (idx >= 0) {
                return { ...f, lines: [...f.lines.slice(0, idx + 1), created, ...f.lines.slice(idx + 1)] }
              }
            }
            return { ...f, lines: [...f.lines, created] }
          }),
        })),
        focusLineId: created.id,
      })
    } catch (e) {
      opFail(e)
    }
  },

  editFragmentLine: async (sid, fid, lid, data) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      const updated = await updateFragmentLineApi(pid, sid, fid, lid, data)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.map((f) =>
            f.id === fid ? { ...f, lines: f.lines.map((l) => (l.id === lid ? updated : l)) } : f,
          ),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  removeFragmentLine: async (sid, fid, lid) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await deleteFragmentLineApi(pid, sid, fid, lid)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.map((f) =>
            f.id === fid ? { ...f, lines: f.lines.filter((l) => l.id !== lid) } : f,
          ),
        })),
      })
    } catch (e) {
      opFail(e)
    }
  },

  shiftFragmentLine: async (sid, fid, lid, delta) => {
    const pid = get().currentProjectId
    if (!pid) return
    try {
      await moveFragmentLineApi(pid, sid, fid, lid, delta)
      set({
        chapters: patchSub(get().chapters, sid, (sub) => ({
          ...sub,
          fragments: sub.fragments.map((f) => {
            if (f.id !== fid) return f
            const arr = [...f.lines]
            const idx = arr.findIndex((l) => l.id === lid)
            if (idx < 0) return f
            const j = idx + delta
            if (j < 0 || j >= arr.length) return f
            ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
            return { ...f, lines: arr }
          }),
        })),
      })
    } catch (e) {
      opFail(e)
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
