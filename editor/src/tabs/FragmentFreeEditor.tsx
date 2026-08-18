import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { SubChapter, SubFragment } from '@storyforge/shared'
import { useEditorStore } from '../store'
import { useAutoSave } from './useAutoSave'

/** 子片段自由写作：与父章节自由写作分开存放（便于 AI 区分内容归属），不同步 LetsGal。
 *  textarea 带行号 + 自适应高度；防抖自动保存 + 切换时 flush。 */
export function FragmentFreeEditor({ sub, fragment }: {
  sub: SubChapter
  fragment: SubFragment
}) {
  const { saveFragmentFreeText, preview, saveSignal } = useEditorStore()
  const [freeText, setFreeText] = useState(fragment.freeText ?? '')

  const taRef = useRef<HTMLTextAreaElement>(null)
  const lineNoRef = useRef<HTMLDivElement>(null)

  const formValueRef = useAutoSave(freeText, fragment.freeText ?? '', () => {
    void saveFragmentFreeText(sub.id, fragment.id, formValueRef.current)
  }, 3000)

  useEffect(() => {
    if (saveSignal > 0) {
      void saveFragmentFreeText(sub.id, fragment.id, formValueRef.current)
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
        <h2>{sub.name} · {fragment.name} · 自由写作</h2>
      </div>
      <div className="sub-editor-body">
        <div className="sub-editor-main">
          <div className="sub-editor-main-inner">
            {preview ? (
              <div className="md-body free-preview">
                {freeText.trim() ? <ReactMarkdown>{freeText}</ReactMarkdown> : <span className="empty-hint">（暂无内容）</span>}
              </div>
            ) : (
              <>
                <label className="field-label">
                  片段自由写作（支持 Markdown，不同步 LetsGal；与父章节自由写作分开存放，便于 AI 区分内容归属）
                </label>
                <div className="free-write-wrap">
                  <div className="free-line-no" ref={lineNoRef} aria-hidden>{lineNumbers}</div>
                  <textarea
                    ref={taRef}
                    className="textarea free-text"
                    value={freeText}
                    placeholder={'支持 Markdown 语法：\n# 标题\n**加粗** *斜体*\n- 列表项\n> 引用'}
                    onChange={(e) => setFreeText(e.target.value)}
                    onScroll={syncScroll}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
