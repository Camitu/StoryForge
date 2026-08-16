import { create } from 'zustand'
import type { Project } from '@storyforge/shared'

interface EditorState {
  project: Project | null
  loadProject: (p: Project) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  project: null,
  loadProject: (project) => set({ project }),
}))
