import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import type { SubChapter } from '@storyforge/shared'
import { useEditorStore } from '../store'
import { useAutoSave } from './useAutoSave'

/** 自由写作编辑：Markdown 写作（编辑 / 预览切换）。
 *  正文 + 右侧属性侧边栏；textarea 带行号、高度随内容自适应；防抖自动保存 + 切换章节 flush。 */
export function FreeEditor({ sub }: { sub: SubChapter }) {
  const { saveSub, preview, saveSignal } = useEditorStore()
  const [freeText, setFreeText] = useState(sub.freeText)
  const [date, setDate] = useState(sub.date)
  const [summary, setSummary] = useState(sub.summary)
  const [tags, setTags] = useState(sub.tags.join(', '))
  const [condense, setCondense] = useState(sub.condense)

  const taRef = useRef<HTMLTextAreaElement>(null)
  const lineNoRef = useRef<HTMLDivElement>(null)

  const formValue = { freeText, date, summary, tags, condense }
  const initial = { freeText: sub.freeText, date: sub.date, summary: sub.summary, tags: sub.tags.join(', '), condense: sub.condense }

  const formValueRef = useAutoSave(formValue, initial, () => {
    const ref = formValueRef.current
    void saveSub(sub.id, {
      name: sub.name,
      date: ref.date,
      summary: ref.summary,
      tags: ref.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      condense: ref.condense,
      mode: 'free',
      freeText: ref.freeText,
    })
  }, 3000)

  // 全局「保存」按钮触发立即保存
  useEffect(() => {
    if (saveSignal > 0) {
      const ref = formValueRef.current
      void saveSub(sub.id, {
        name: sub.name,
        date: ref.date,
        summary: ref.summary,
        tags: ref.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        condense: ref.condense,
        mode: 'free',
        freeText: ref.freeText,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  // textarea 高度随内容自适应
  useEffect(() => {
    const el = taRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [freeText, preview])

  const syncScroll = () => {
    if (lineNoRef.current && taRef.current) {
      lineNoRef.current.scrollTop = taRef.current.scrollTop
    }
  }

  const lineCount = Math.max(1, freeText.split('\n').length)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')

  return (
    <div className="sub-editor free-writing">
      <div className="sub-editor-head">
        <h2>{sub.name} · 自由写作</h2>
      </div>

      <div className="sub-editor-body">
        <div className="sub-editor-main">
          <div className="sub-editor-main-inner">
            {preview ? (
              <div className="md-body free-preview">
                {freeText.trim() ? <ReactMarkdown remarkPlugins={[remarkBreaks]}>{freeText}</ReactMarkdown> : <span className="empty-hint">（暂无内容）</span>}
              </div>
            ) : (
              <>
                <label className="field-label">自由写作（支持 Markdown，不同步 LetsGal；可后续让 AI 转为标准写作）</label>
                <div className="free-write-wrap">
                  <div className="free-line-no" ref={lineNoRef} aria-hidden>{lineNumbers}</div>
                  <textarea
                    ref={taRef}
                    className="textarea free-text"
                    value={freeText}
                    placeholder={'支持 Markdown 语法：\n# 标题\n**加粗** *斜体*\n- 列表项\n> 引用\n--- 分隔线'}
                    onChange={(e) => setFreeText(e.target.value)}
                    onScroll={syncScroll}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {!preview && (
          <aside className="sub-sidebar">
            <label className="field-label">时间线日期</label>
            <input type="date" className="input date-input sidebar-date" value={date} placeholder="2026-06-19" onChange={(e) => setDate(e.target.value)} />
            <label className="field-label">标签</label>
            <input className="input" value={tags} placeholder="日常, 重逢" onChange={(e) => setTags(e.target.value)} />
            <label className="field-label">剧情概要（写作指引）</label>
            <textarea className="textarea" rows={4} value={summary} placeholder="本小节剧情概览…" onChange={(e) => setSummary(e.target.value)} />
            <label className="field-label">剧情浓缩（压缩上下文）</label>
            <textarea className="textarea" rows={3} value={condense} placeholder="只记录会影响后续的关键点…" onChange={(e) => setCondense(e.target.value)} />
          </aside>
        )}
      </div>
    </div>
  )
}
