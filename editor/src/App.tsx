import { useEffect, useState } from 'react'
import { useEditorStore } from './store'
import { ProjectSelect } from './ProjectSelect'
import { MainTabs } from './MainTabs'
import { DialogHost } from './ui/DialogHost'
import { ToastHost } from './ui/ToastHost'

const THEME_KEY = 'storyforge-theme'

export default function App() {
  const { projects, currentProjectId, refreshProjects, openProject } = useEditorStore()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects])

  // 若当前项目被删/失效，回到项目选择
  useEffect(() => {
    if (currentProjectId && !projects.some((p) => p.id === currentProjectId)) {
      useEditorStore.setState({ currentProjectId: null, project: null })
    }
  }, [projects, currentProjectId])

  if (!currentProjectId) {
    return (
      <>
        <button
          className="theme-toggle project-select-theme"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          title="切换主题"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <ProjectSelect projects={projects} onOpen={openProject} />
        <DialogHost />
        <ToastHost />
      </>
    )
  }

  return (
    <>
      <MainTabs />
      <DialogHost />
      <ToastHost />
    </>
  )
}
