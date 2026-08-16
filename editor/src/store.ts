import { create } from 'zustand'
import type { Project } from '@storyforge/shared'
import { getProject, listProjects, saveProject, type ProjectSummary } from './api'

interface EditorState {
  projects: ProjectSummary[]
  project: Project | null
  saving: boolean
  error: string | null
  refreshProjects: () => Promise<ProjectSummary[]>
  loadProject: (id: string) => Promise<void>
  saveCurrent: () => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projects: [],
  project: null,
  saving: false,
  error: null,

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
}))
