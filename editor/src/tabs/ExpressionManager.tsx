import { useCallback, useEffect, useRef, useState } from 'react'
import { listCharacterExpressions, replaceCharacterExpression } from '../api'
import type { CharacterExpressionsResult } from '../api'
import { useEditorStore } from '../store'
import { toast } from '../ui/toast'

/**
 * 角色表情差分管理弹窗：
 * - 总览该角色在全部剧情（含子片段）中已使用的表情与次数
 * - 批量替换：点击「批量替换」后，该行表情列变为下拉框（候选 = 该角色已用表情，
 *   顶部含「（清除表情）」），选好目标后点「确认」完成替换
 * 替换后刷新章节数据（写作 Tab 同步显示）。
 */
export function ExpressionManager({ cid, charName, onClose }: { cid: string; charName: string; onClose: () => void }) {
  const { currentProjectId, loadChapters } = useEditorStore()
  const pid = currentProjectId!
  const [data, setData] = useState<CharacterExpressionsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null) // 正在替换的表情
  const [replacing, setReplacing] = useState<string | null>(null) // 展开替换下拉的表情
  const [replaceTo, setReplaceTo] = useState('')
  const selectRef = useRef<HTMLSelectElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const d = await listCharacterExpressions(pid, cid)
      setData(d)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [pid, cid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openReplace = (from: string) => {
    setReplacing(from)
    setReplaceTo(from) // 下拉默认选中当前表情
    // 等渲染后聚焦下拉框
    requestAnimationFrame(() => selectRef.current?.focus())
  }

  const cancelReplace = () => {
    setReplacing(null)
    setReplaceTo('')
  }

  const confirmReplace = async (from: string) => {
    const target = replaceTo.trim()
    if (target === from) {
      cancelReplace() // 未改动，直接收起
      return
    }
    setBusy(from)
    try {
      const r = await replaceCharacterExpression(pid, cid, from, target)
      toast(`已替换 ${r.replaced} 处：${from} → ${target || '（清除）'}`, 'success')
      await refresh()
      await loadChapters() // 写作 Tab 同步更新
      cancelReplace()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="expr-mgr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="expr-mgr-panel">
        <div className="expr-mgr-header">
          <h3>{charName} · 表情差分</h3>
          <span className="expr-mgr-count">
            {data ? `${data.expressions.length} 种表情 / 共使用 ${data.total} 次` : '…'}
          </span>
          <button className="ghost-btn small" onClick={onClose} title="关闭">✕</button>
        </div>

        <div className="expr-mgr-body">
          {loading && !data && <div className="expr-mgr-empty">加载中…</div>}
          {!loading && data && data.expressions.length === 0 && (
            <div className="expr-mgr-empty">
              该角色还没有使用过表情。<br />
              <span className="expr-mgr-hint">写作时在对白行「表情」框输入，如：开心 / 衬衫·开心（服装·表情）。</span>
            </div>
          )}
          {data && data.expressions.length > 0 && (
            <div className="expr-mgr-list">
              {data.expressions.map((e) => {
                const isReplacing = replacing === e.expression
                return (
                  <div key={e.expression} className="expr-mgr-item">
                    {isReplacing ? (
                      <select
                        ref={selectRef}
                        className="expr-mgr-select"
                        value={replaceTo}
                        onChange={(ev) => setReplaceTo(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') void confirmReplace(e.expression)
                          if (ev.key === 'Escape') cancelReplace()
                        }}
                      >
                        <option value="">（清除表情）</option>
                        {data.expressions
                          .filter((x) => x.expression !== e.expression)
                          .map((x) => (
                            <option key={x.expression} value={x.expression}>{x.expression}</option>
                          ))}
                      </select>
                    ) : (
                      <span className="expr-mgr-item-expr">{e.expression}</span>
                    )}
                    <span className="expr-mgr-item-count">×{e.count}</span>
                    {isReplacing ? (
                      <span className="expr-mgr-item-actions">
                        <button
                          className="primary-btn small"
                          disabled={busy === e.expression}
                          onClick={() => void confirmReplace(e.expression)}
                        >
                          {busy === e.expression ? '替换中…' : '确认'}
                        </button>
                        <button className="ghost-btn small" onClick={cancelReplace}>取消</button>
                      </span>
                    ) : (
                      <button
                        className="ghost-btn small"
                        disabled={busy === e.expression}
                        onClick={() => openReplace(e.expression)}
                      >
                        {busy === e.expression ? '替换中…' : '批量替换'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="expr-mgr-footer">
          <span className="expr-mgr-hint">
            提示：表情对应 LetsGal 立绘差分。格式建议「服装·表情」（如 衬衫·开心）。<br />
            批量替换可归纳同义表情（如 开心 → 高兴）；下拉列表仅含本角色已用表情，选「（清除表情）」可移除。
          </span>
        </div>
      </div>
    </div>
  )
}
