import { useEffect } from 'react'
import { useEditorStore } from './store'

/** 全局错误提示：自动 5 秒消失，可手动关闭 */
export function ErrorBanner({ compact = false }: { compact?: boolean }) {
  const { error, clearError } = useEditorStore()

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  if (!error) return null
  return (
    <div className={`error-banner ${compact ? 'compact' : ''}`}>
      <span className="error-icon">⚠️</span>
      <span className="error-text">{error}</span>
      <button className="error-close" onClick={clearError}>✕</button>
    </div>
  )
}
