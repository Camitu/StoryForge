import { useCallback, useEffect, useState } from 'react'
import { fsList } from '../api'
import { toast } from './toast'

/** 全屏文件夹选择器：浏览本地目录结构，选择文件夹。
 *  与「双击角色形象卡选图」类似的全屏界面，只是这里选的是文件夹。
 */
export function FolderPicker({ onSelect, onCancel }: { onSelect: (path: string) => void; onCancel: () => void }) {
  const [path, setPath] = useState('')
  const [dirs, setDirs] = useState<string[]>([])
  const [drives, setDrives] = useState<string[]>([])
  const [parent, setParent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const d = await fsList(p)
      setPath(d.path)
      setDirs(d.dirs)
      setDrives(d.drives)
      setParent(d.parent)
      setSelected(null)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enter = (name: string) => {
    const next = path ? `${path}\\${name}` : name
    void load(next)
  }

  const currentTarget = selected ?? (path || drives[0] || '')
  const canSelect = !!currentTarget

  return (
    <div className="fp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="fp-panel">
        {/* 头部：标题 + 当前路径 + 关闭 */}
        <div className="fp-header">
          <h3 className="fp-title">选择文件夹</h3>
          <span className="fp-path" title={path || '（选择盘符）'}>{path || '（选择盘符）'}</span>
          <button className="ghost-btn small" onClick={onCancel} title="关闭">✕</button>
        </div>

        {/* 快捷导航：上级 */}
        <div className="fp-toolbar">
          <button className="ghost-btn small" disabled={!parent} onClick={() => parent && void load(parent)}>
            ⬆ 上级目录
          </button>
          <button className="ghost-btn small" disabled={!path} onClick={() => void load('')}>
            💿 盘符列表
          </button>
          <span className="fp-count">{dirs.length} 个子目录{loading ? '（加载中…）' : ''}</span>
        </div>

        {/* 目录/盘符网格 */}
        <div className="fp-grid">
          {path === '' &&
            drives.map((d) => (
              <button
                key={d}
                className={`fp-item ${selected === d ? 'fp-item-sel' : ''}`}
                onClick={() => setSelected(d)}
                onDoubleClick={() => enter(d)}
                title={`进入 ${d}`}
              >
                <span className="fp-item-icon">💿</span>
                <span className="fp-item-name">{d}</span>
              </button>
            ))}
          {dirs.map((d) => (
            <button
              key={d}
              className={`fp-item ${selected === d ? 'fp-item-sel' : ''}`}
              onClick={() => setSelected(d)}
              onDoubleClick={() => enter(d)}
              title={`进入 ${d}`}
            >
              <span className="fp-item-icon">📁</span>
              <span className="fp-item-name">{d}</span>
            </button>
          ))}
          {path !== '' && dirs.length === 0 && !loading && (
            <div className="fp-empty">（此目录下没有子文件夹）</div>
          )}
          {path === '' && drives.length === 0 && !loading && (
            <div className="fp-empty">（未检测到盘符）</div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="fp-footer">
          <span className="fp-target" title={currentTarget}>{currentTarget}</span>
          <div className="fp-actions">
            <button className="ghost-btn" onClick={onCancel}>取消</button>
            <button className="primary-btn" disabled={!canSelect} onClick={() => onSelect(currentTarget)}>
              选择此文件夹
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
