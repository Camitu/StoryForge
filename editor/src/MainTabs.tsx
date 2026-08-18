import { useEffect, useState } from 'react'
import { useEditorStore, type TabId } from './store'
import { ErrorBanner } from './ErrorBanner'
import { WorldTab } from './tabs/WorldTab'
import { WritingTab } from './tabs/WritingTab'
import { ForeshadowTab } from './tabs/ForeshadowTab'
import { TimelineTab } from './tabs/TimelineTab'
import { SyncTab } from './tabs/SyncTab'

const TABS: { id: TabId; label: string }[] = [
  { id: 'world', label: '人设世界观' },
  { id: 'writing', label: '章节写作管理' },
  { id: 'foreshadow', label: '剧情伏笔与回收' },
  { id: 'timeline', label: '时间线与浓缩剧情' },
  { id: 'sync', label: 'LetsGal同步' },
]

const THEME_KEY = 'storyforge-theme'

export function MainTabs() {
  const { project, tab, setTab, closeProject } = useEditorStore()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <div className="main-tabs">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo" title={project?.name}>{project?.name ?? '📖 StoryForge'}</span>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <button className="ghost-btn small" onClick={closeProject}>← 项目列表</button>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'light' ? '切换到暗色' : '切换到浅色'}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>
      <div className="tab-content">
        <ErrorBanner />
        {tab === 'world' && <WorldTab />}
        {tab === 'writing' && <WritingTab />}
        {tab === 'foreshadow' && <ForeshadowTab />}
        {tab === 'timeline' && <TimelineTab />}
        {tab === 'sync' && <SyncTab />}
      </div>
    </div>
  )
}
