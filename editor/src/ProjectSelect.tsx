import { useState } from 'react'
import { useEditorStore } from './store'
import { deleteProject } from './api'
import type { ProjectSummary } from './api'
import { ErrorBanner } from './ErrorBanner'

export function ProjectSelect({ projects, onOpen }: { projects: ProjectSummary[]; onOpen: (id: string) => Promise<void> }) {
  const { createNewProject, refreshProjects } = useEditorStore()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [storageDir, setStorageDir] = useState('')

  const submitNew = async () => {
    if (!name.trim()) return
    await createNewProject(name.trim(), storageDir.trim() || undefined)
    setShowNew(false)
    setName('')
    setStorageDir('')
  }

  const onDelete = async (p: ProjectSummary) => {
    const msg = p.storageDir
      ? `确定删除项目「${p.name}」？\n\n将删除本地工程文件：\n${p.storageDir}\\project.json\n\n（不会动 LetsGal 项目）`
      : `确定删除项目「${p.name}」？`
    if (!window.confirm(msg)) return
    try {
      await deleteProject(p.id)
      await refreshProjects()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="project-select">
      <div className="project-select-header">
        <h1>📖 StoryForge</h1>
        <p className="subtitle">LetsGal 上游剧情写作工具</p>
      </div>

      <div className="project-grid">
        {projects.map((p) => (
          <div key={p.id} className="project-card-wrap">
            <button className="project-card" onClick={() => void onOpen(p.id)}>
              <span className="project-card-name">{p.name}</span>
              {p.storageDir && <span className="project-card-dir">{p.storageDir}</span>}
            </button>
            <button
              className="project-card-delete"
              title="删除项目（本地文件和工程）"
              onClick={() => void onDelete(p)}
            >
              🗑
            </button>
          </div>
        ))}
        {projects.length === 0 && <div className="empty-hint">还没有项目，点击下方新建</div>}
      </div>

      {!showNew ? (
        <button className="new-project-btn" onClick={() => setShowNew(true)}>
          ＋ 新建项目
        </button>
      ) : (
        <div className="new-project-form">
          <input
            className="input"
            placeholder="项目名称"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitNew()}
          />
          <input
            className="input"
            placeholder="项目存储根目录（可选，如 E:\\GamePro\\我的游戏）"
            value={storageDir}
            onChange={(e) => setStorageDir(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitNew()}
          />
          <div className="new-project-actions">
            <button className="primary-btn" onClick={() => void submitNew()} disabled={!name.trim()}>
              创建
            </button>
            <button className="ghost-btn" onClick={() => setShowNew(false)}>
              取消
            </button>
          </div>
        </div>
      )}
      <ErrorBanner />
    </div>
  )
}
