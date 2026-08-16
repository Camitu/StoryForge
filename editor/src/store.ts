import { create } from 'zustand'
import type { Project, Section, SubChapter } from '@storyforge/shared'
import { getProject, listProjects, saveProject, type ProjectSummary } from './api'

export type ViewId = 'script' | 'assets'

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
  updateSubChapter: (id: string, patch: Partial<SubChapter>) => void
  updateSection: (id: string, patch: Partial<Section>) => void
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
    set({
      project: {
        ...project,
        chapters: project.chapters.map((c) => ({
          ...c,
          subChapters: c.subChapters.map((sc) => ({
            ...sc,
            sections: sc.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          })),
        })),
      },
    })
  },
}))
