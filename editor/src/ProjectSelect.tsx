import { useState } from 'react'
import { useEditorStore } from './store'
import { deleteProject } from './api'
import type { ProjectSummary } from './api'
import { ErrorBanner } from './ErrorBanner'
import { confirmDialog } from './ui/dialog'
import { FolderPicker } from './ui/FolderPicker'
import { toast } from './ui/toast'

/** 默认存储根目录（与后端 config.DEFAULT_STORAGE_ROOT 保持一致） */
const DEFAULT_STORAGE_ROOT = 'E:\\Apps\\StoryForge\\projects'

export function ProjectSelect({ projects, onOpen }: { projects: ProjectSummary[]; onOpen: (id: string) => Promise<void> }) {
  const { createNewProject, refreshProjects } = useEditorStore()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [storageDir, setStorageDir] = useState('')
  const [picking, setPicking] = useState(false)

  /** 最终项目存储路径预览：父目录 + 项目名文件夹 */
  const finalPath = (() => {
    const parent = storageDir.trim() || DEFAULT_STORAGE_ROOT
    const folder = name.trim() || '项目名'
    return `${parent}\\${folder}\\project.json`
  })()

  const submitNew = async () => {
    if (!name.trim()) return
    await createNewProject(name.trim(), storageDir.trim() || undefined)
    setShowNew(false)
    setName('')
    setStorageDir('')
  }

  const onDelete = async (p: ProjectSummary) => {
    const msg = p.storageDir
      ? `将删除本地工程文件：\n${p.storageDir}\\project.json\n\n（不会动 LetsGal 项目）`
      : undefined
    const ok = await confirmDialog({
      title: `确定删除项目「${p.name}」？`,
      message: msg,
      okText: '删除',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteProject(p.id)
      await refreshProjects()
      toast('项目已删除', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
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
          <div className="dir-row">
            <input
              className="input"
              placeholder={`项目存储根目录（可选，默认 ${DEFAULT_STORAGE_ROOT}）`}
              value={storageDir}
              onChange={(e) => setStorageDir(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submitNew()}
            />
            <button type="button" className="ghost-btn" onClick={() => setPicking(true)} title="全屏浏览并选择文件夹">
              📁 浏览…
            </button>
          </div>
          <div className="dir-preview">📂 将存储到：<code>{finalPath}</code></div>
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

      {picking && (
        <FolderPicker
          onSelect={(dir) => { setStorageDir(dir); setPicking(false) }}
          onCancel={() => setPicking(false)}
        />
      )}
    </div>
  )
}
