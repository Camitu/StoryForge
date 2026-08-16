import { create } from 'zustand'
import type { Beat, Project, Section, SubChapter } from '@storyforge/shared'
import { createProject, getProject, listProjects, saveProject, type ProjectSummary } from './api'

export type ViewId = 'script' | 'assets'

/** 对每个小节应用 fn，返回新 Project（用于深度不可变更新） */
function mapSections(project: Project, fn: (s: Section) => Section): Project {
  return {
    ...project,
    chapters: project.chapters.map((c) => ({
      ...c,
      subChapters: c.subChapters.map((sc) => ({
        ...sc,
        sections: sc.sections.map(fn),
      })),
    })),
  }
}

interface EditorState {
  projects: ProjectSummary[]
  project: Project | null
  view: ViewId
  saving: boolean
  error: string | null
  setView: (v: ViewId) => void
  refreshProjects: () => Promise<ProjectSummary[]>
  loadProject: (id: string) => Promise<void>
  saveCurrent: () => Promise<void>
  createProject: (name: string) => Promise<Project | null>
  addChapter: (name: string) => void
  addSubChapter: (chapterId: string, name: string) => void
  addSection: (subChapterId: string, name: string) => void
  updateSubChapter: (id: string, patch: Partial<SubChapter>) => void
  updateSection: (id: string, patch: Partial<Section>) => void
  addBeat: (sectionId: string, beat: Beat) => void
  updateBeat: (sectionId: string, index: number, patch: Record<string, unknown>) => void
  deleteBeat: (sectionId: string, index: number) => void
  moveBeat: (sectionId: string, index: number, dir: -1 | 1) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projects: [],
  project: null,
  view: 'script',
  saving: false,
  error: null,

  setView: (view) => set({ view }),

  refreshProjects: async () => {
    try {
      const projects = await listProjects()
      set({ projects, error: null })
      return projects
    } catch (e) {
      set({ error: (e as Error).message })
      return []
    }
  },

  loadProject: async (id) => {
    try {
      const project = await getProject(id)
      set({ project, error: null })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  saveCurrent: async () => {
    const project = get().project
    if (!project) return
    set({ saving: true, error: null })
    try {
      await saveProject(project)
      set({ saving: false })
    } catch (e) {
      set({ saving: false, error: (e as Error).message })
    }
  },

  createProject: async (name) => {
    try {
      const project = await createProject(name)
      set({ project, error: null })
      await get().refreshProjects()
      return project
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  addChapter: (name) => {
    const project = get().project
    if (!project) return
    const id = crypto.randomUUID()
    set({
      project: {
        ...project,
        chapterOrder: [...project.chapterOrder, id],
        chapters: [...project.chapters, { id, name, summary: '', subChapters: [] }],
      },
    })
  },

  addSubChapter: (chapterId, name) => {
    const project = get().project
    if (!project) return
    set({
      project: {
        ...project,
        chapters: project.chapters.map((c) =>
          c.id === chapterId
            ? { ...c, subChapters: [...c.subChapters, { id: crypto.randomUUID(), name, summary: '', sections: [] }] }
            : c,
        ),
      },
    })
  },

  addSection: (subChapterId, name) => {
    const project = get().project
    if (!project) return
    set({
      project: {
        ...project,
        chapters: project.chapters.map((c) => ({
          ...c,
          subChapters: c.subChapters.map((sc) =>
            sc.id === subChapterId
              ? {
                  ...sc,
                  sections: [...sc.sections, { id: crypto.randomUUID(), name, time: '', summary: '', beats: [] }],
                }
              : sc,
          ),
        })),
      },
    })
  },

  updateSubChapter: (id, patch) => {
    const project = get().project
    if (!project) return
    set({
      project: {
        ...project,
        chapters: project.chapters.map((c) => ({
          ...c,
          subChapters: c.subChapters.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
        })),
      },
    })
  },

  updateSection: (id, patch) => {
    const project = get().project
    if (!project) return
    set({ project: mapSections(project, (s) => (s.id === id ? { ...s, ...patch } : s)) })
  },

  addBeat: (sectionId, beat) => {
    const project = get().project
    if (!project) return
    set({ project: mapSections(project, (s) => (s.id === sectionId ? { ...s, beats: [...s.beats, beat] } : s)) })
  },

  updateBeat: (sectionId, index, patch) => {
    const project = get().project
    if (!project) return
    set({
      project: mapSections(project, (s) =>
        s.id === sectionId ? { ...s, beats: s.beats.map((b, i) => (i === index ? ({ ...b, ...patch } as Beat) : b)) } : s,
      ),
    })
  },

  deleteBeat: (sectionId, index) => {
    const project = get().project
    if (!project) return
    set({
      project: mapSections(project, (s) =>
        s.id === sectionId ? { ...s, beats: s.beats.filter((_, i) => i !== index) } : s,
      ),
    })
  },

  moveBeat: (sectionId, index, dir) => {
    const project = get().project
    if (!project) return
    set({
      project: mapSections(project, (s) => {
        if (s.id !== sectionId) return s
        const beats = [...s.beats]
        const j = index + dir
        if (j < 0 || j >= beats.length) return s
        ;[beats[index], beats[j]] = [beats[j], beats[index]]
        return { ...s, beats }
      }),
    })
  },
}))
