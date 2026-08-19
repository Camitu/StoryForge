import { useEditorStore } from '../store'
import { confirmDialog, promptDialog } from '../ui/dialog'

/** 剧情伏笔与回收 Tab：列表展示，可跳转 */
export function ForeshadowTab() {
  const { foreshadows, chapters, setSelectedSub, setTab, markForeshadow, unmarkForeshadow, removeForeshadow } = useEditorStore()

  const subNameById = (id: string) => {
    for (const ch of chapters) {
      const sub = ch.subChapters.find((s) => s.id === id)
      if (sub) return `${ch.name} / ${sub.name}`
    }
    return id.slice(0, 8)
  }

  const jumpTo = (subId: string) => {
    setSelectedSub(subId)
    setTab('writing')
  }

  return (
    <div className="foreshadow-tab">
      <h2>剧情伏笔与回收（{foreshadows.length}）</h2>
      <table className="foreshadow-table">
        <thead>
          <tr>
            <th>伏笔时间线</th>
            <th>伏笔内容</th>
            <th>是否回收</th>
            <th>回收时间线</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {foreshadows.map((f) => (
            <tr key={f.id} className={f.status === 'resolved' ? 'resolved' : ''}>
              <td>
                <button className="date-link" onClick={() => jumpTo(f.plantedAt.subChapterId)} title={subNameById(f.plantedAt.subChapterId)}>
                  {f.plantedDate || '--'}
                </button>
              </td>
              <td className="fs-content">{f.content}</td>
              <td>{f.status === 'resolved' ? '✅ 已回收' : '⬜ 未回收'}</td>
              <td>
                {f.resolvedAt ? (
                  <button className="date-link" onClick={() => jumpTo(f.resolvedAt!.subChapterId)} title={subNameById(f.resolvedAt!.subChapterId)}>
                    {f.resolvedDate || '--'}
                  </button>
                ) : (
                  '—'
                )}
              </td>
              <td className="fs-actions">
                {f.status === 'open' ? (
                  <button className="ghost-btn small" onClick={async () => {
                    const note = await promptDialog({ title: '回收伏笔', message: '回收说明（可选，例如「第 3 章揭示真相」）', placeholder: '回收说明' })
                    void markForeshadow(f.id, f.plantedAt.subChapterId, undefined, note ?? undefined)
                  }}>
                    回收
                  </button>
                ) : (
                  <button className="ghost-btn small" onClick={() => void unmarkForeshadow(f.id)}>重开</button>
                )}
                <button className="danger-btn small" onClick={async () => {
                  const ok = await confirmDialog({ title: '删除这条伏笔？', okText: '删除', danger: true })
                  if (ok) void removeForeshadow(f.id)
                }}>
                  删
                </button>
              </td>
            </tr>
          ))}
          {foreshadows.length === 0 && (
            <tr><td colSpan={5} className="empty-hint">还没有伏笔。在章节写作中，行尾「＋」按钮可新建伏笔。</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
