import { useEffect, useState } from 'react'
import type { Character, Scene, SubChapter } from '@storyforge/shared'
import { useEditorStore } from '../store'
import { useAutoSave } from './useAutoSave'
import { LineRow } from './LineRow'
import { LinePreview } from './LinePreview'
import { withExternalBlocks } from './ExternalBlockRow'

/** 小章节编辑：标题行 + 正文（行编辑/预览） + 右侧属性侧边栏。
 *  属性输入本地缓冲 + 防抖自动保存（3s）+ 切换章节/手动保存时 flush，不丢内容。 */
export function SubChapterEditor({ sub, characters, scenes }: {
  sub: SubChapter
  characters: Character[]
  scenes: Scene[]
}) {
  const { saveSub, addLine, preview, saveSignal } = useEditorStore()
  const [name, setName] = useState(sub.name)
  const [date, setDate] = useState(sub.date)
  const [summary, setSummary] = useState(sub.summary)
  const [tags, setTags] = useState(sub.tags.join(', '))
  const [condense, setCondense] = useState(sub.condense)

  const formValue = { name, date, summary, tags, condense }
  const initial = { name: sub.name, date: sub.date, summary: sub.summary, tags: sub.tags.join(', '), condense: sub.condense }

  const formValueRef = useAutoSave(formValue, initial, () => {
    void saveSub(sub.id, {
      name: formValueRef.current.name,
      date: formValueRef.current.date,
      summary: formValueRef.current.summary,
      tags: formValueRef.current.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      condense: formValueRef.current.condense,
      mode: sub.mode,
      freeText: sub.freeText,
    })
  }, 3000)

  // 全局「保存」按钮触发立即保存
  useEffect(() => {
    if (saveSignal > 0) {
      const ref = formValueRef.current
      void saveSub(sub.id, {
        name: ref.name,
        date: ref.date,
        summary: ref.summary,
        tags: ref.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        condense: ref.condense,
        mode: sub.mode,
        freeText: sub.freeText,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  const addDialogue = () => void addLine(sub.id, { kind: 'dialogue', characterId: characters[0]?.id ?? '', characterName: characters[0]?.name ?? '', text: '' })
  const addNarration = () => void addLine(sub.id, { kind: 'narration', text: '' })
  const addScene = () => void addLine(sub.id, { kind: 'scene', sceneId: scenes[0]?.id ?? '', sceneName: scenes[0]?.name ?? '' })

  return (
    <div className="sub-editor">
      {/* 标题行：章节名（保存/编辑预览在全局工具栏） */}
      <div className="sub-editor-head">
        <input
          className="input sub-title-input"
          value={name}
          placeholder="章节名称"
          onChange={(e) => setName(e.target.value)}
          disabled={preview}
        />
      </div>

      <div className="sub-editor-body">
        {/* 正文：编辑（行列表）/ 预览（只读渲染） */}
        <div className="sub-editor-main">
          <div className="sub-editor-main-inner">
            {preview ? (
              <LinePreview lines={sub.lines} externalBlocks={sub.externalBlocks} characters={characters} scenes={scenes} />
            ) : (
              <>
                <div className="line-toolbar">
                  <span className="line-count">主内容（{sub.lines.length} 行）</span>
                  <button className="add-btn" onClick={addDialogue}>＋ 对白</button>
                  <button className="add-btn" onClick={addNarration}>＋ 旁白</button>
                  <button className="add-btn" onClick={addScene}>＋ 切场景</button>
                </div>
                <div className="line-list">
                  {withExternalBlocks(sub.lines, sub.externalBlocks, (line, i) => (
                    <LineRow key={line.id} subId={sub.id} index={i} line={line} characters={characters} scenes={scenes} />
                  ))}
                  {sub.lines.length === 0 && (sub.externalBlocks?.length ?? 0) === 0 && <div className="empty-hint">还没有剧情行，点击上方按钮添加</div>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 右侧属性侧边栏（仅编辑模式显示） */}
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
