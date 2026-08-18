import { useMemo } from 'react'
import { useEditorStore } from '../store'

/** 时间线与浓缩剧情 Tab：垂直时间线（日期 + 圆点 + 章节名 + 浓缩只读展示），
 *  仅显示已填写浓缩剧情的章节；点击「定位章节」跳转写作界面修改。 */
export function TimelineTab() {
  const { chapters, setSelectedSub, setTab } = useEditorStore()

  // 按日期排序、且已填写浓缩剧情的章节（空日期排最后）
  const sorted = useMemo(() => {
    const items = chapters.flatMap((ch) =>
      ch.subChapters
        .filter((sub) => (sub.condense ?? '').trim() !== '')
        .map((sub) => ({ sub, chapter: ch })),
    )
    return items.sort((a, b) => {
      if (!a.sub.date && !b.sub.date) return 0
      if (!a.sub.date) return 1
      if (!b.sub.date) return -1
      return a.sub.date.localeCompare(b.sub.date)
    })
  }, [chapters])

  const gotoWriting = (subId: string) => {
    setSelectedSub(subId)
    setTab('writing')
  }

  return (
    <div className="timeline-tab">
      <h2>时间线与浓缩剧情</h2>
      <div className="timeline-vertical">
        {sorted.map(({ sub }) => (
          <div key={sub.id} className="tl-card">
            <div className="tl-card-head">
              <span className="tl-card-date">{sub.date || '--'}</span>
              <span className="tl-dot" />
              <span className="tl-card-name">{sub.name}</span>
              <button
                className="ghost-btn small"
                onClick={() => gotoWriting(sub.id)}
                title="跳转到对应章节写作界面（右侧属性栏修改浓缩）"
              >
                定位章节 →
              </button>
            </div>
            <div className="tl-card-condense-view">{sub.condense}</div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="empty-hint">还没有填写浓缩剧情的章节。在章节写作的右侧属性栏填写「剧情浓缩」后，会显示在这里。</div>
        )}
      </div>
    </div>
  )
}
