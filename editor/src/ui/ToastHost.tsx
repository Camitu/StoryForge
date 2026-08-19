import { useEffect, useState } from 'react'
import { getToasts, subscribeToasts, dismissToast } from './toast'

/** 全局 Toast 挂载点：右下角堆叠提示 */
export function ToastHost() {
  const [, force] = useState(0)

  useEffect(() => subscribeToasts(() => force((n) => n + 1)), [])

  const items = getToasts()
  if (items.length === 0) return null

  return (
    <div className="toast-stack">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <span className="toast-icon">{t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : 'ℹ'}</span>
          <span className="toast-text">{t.text}</span>
          <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="关闭">✕</button>
        </div>
      ))}
    </div>
  )
}
