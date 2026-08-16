import { useEffect, useState } from 'react'
import { useEditorStore } from './store'
import { ScriptView } from './components/ScriptView'
import { AssetView } from './components/AssetView'

export default function App() {
  const { projects, project, view, saving, error, setView, refreshProjects, loadProject, saveCurrent, createProject } =
    useEditorStore()
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    refreshProjects().then((list) => {
      if (list.length > 0) {
        setSelectedId(list[0].id)
        loadProject(list[0].id)
      }
    })
  }, [refreshProjects, loadProject])

  const onCreateProject = async () => {
    const name = window.prompt('工程名称')
    if (!name) return
    const p = await createProject(name)
    if (p) setSelectedId(p.id)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>StoryForge</h2>
        <nav className="nav">
          <button className={view === 'script' ? 'active' : ''} onClick={() => setView('script')}>
            脚本总览
          </button>
          <button className={view === 'assets' ? 'active' : ''} onClick={() => setView('assets')}>
            资产库
          </button>
        </nav>
        <hr className="divider" />
        <h3 className="sidebar-title">工程</h3>
        <ul className="project-list">
          {projects.map((p) => (
            <li
              key={p.id}
              className={p.id === selectedId ? 'active' : ''}
              onClick={() => {
                setSelectedId(p.id)
                loadProject(p.id)
              }}
            >
              {p.name}
            </li>
          ))}
        </ul>
        <button className="new-btn" onClick={onCreateProject}>
          ＋ 新建项目
        </button>
        {project && (
          <button className="save-btn" onClick={saveCurrent} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </aside>

      <main className="content">
        {!project ? (
          <div className="loading">加载中…</div>
        ) : view === 'script' ? (
          <ScriptView project={project} />
        ) : (
          <AssetView project={project} />
        )}
      </main>
    </div>
  )
}
