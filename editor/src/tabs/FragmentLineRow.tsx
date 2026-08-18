import { useEffect, useRef, useState } from 'react'
import type { Character, Scene, ScriptLine } from '@storyforge/shared'
import { useEditorStore } from '../store'
import { CharacterPicker, ScenePicker } from './Pickers'

const TEXT_SAVE_DELAY = 800

interface FragmentLineRowProps {
  subId: string
  line: ScriptLine
  /** 行号（从 0 开始），显示为序号 */
  index: number
  characters: Character[]
  scenes: Scene[]
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
  onMove: (delta: number) => void
}

/** 行编辑器（用于子片段）：序号 + 角色/表情/对白/场景 + 同行操作按钮（含伏笔）。
 *  文本输入本地缓冲 + 防抖自动保存（打字不卡），卸载时 flush 不丢内容。 */
export function FragmentLineRow({ subId, line, index, characters, scenes, onChange, onDelete, onMove }: FragmentLineRowProps) {
  const { addForeshadow, markForeshadow, foreshadows } = useEditorStore()
  const [showForeshadowMenu, setShowForeshadowMenu] = useState(false)

  const isDialogue = line.kind === 'dialogue'
  const isNarration = line.kind === 'narration'
  const isScene = line.kind === 'scene'

  const text = 'text' in line ? line.text : ''
  const charName = 'characterName' in line ? (line.characterName ?? '') : ''
  const expression = 'expression' in line ? (line.expression ?? '') : ''
  const sceneName = 'sceneName' in line ? (line.sceneName ?? '') : ''

  // ---- 文本本地缓冲 + 防抖保存 ----
  const [draft, setDraft] = useState(text)
  const draftRef = useRef(draft)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commitText = (value: string) => {
    if (value === text) return
    onChange({ text: value })
  }

  const flushText = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    commitText(draftRef.current)
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    draftRef.current = value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      commitText(value)
    }, TEXT_SAVE_DELAY)
  }

  // 卸载（切换章节/片段）时 flush，避免丢内容
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (draftRef.current !== text) commitText(draftRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 伏笔锚点：本行埋设的伏笔（含已回收，一直显示） / 本行回收的伏笔
  const plantedHere = foreshadows.filter((f) => f.plantedAt?.lineId === line.id)
  const resolvedHere = foreshadows.filter((f) => f.resolvedAt?.lineId === line.id)
  const plantedTitle = `本行埋设伏笔×${plantedHere.length}：${plantedHere.map((f) => `${f.content}${f.status === 'resolved' ? '（已回收）' : ''}`).join('；')}`
  const resolvedTitle = `本行回收伏笔×${resolvedHere.length}：${resolvedHere.map((f) => f.content).join('；')}`

  // 菜单外部点击自动关闭
  useEffect(() => {
    if (!showForeshadowMenu) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.foreshadow-menu') && !t.closest('.line-foreshadow')) {
        setShowForeshadowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showForeshadowMenu])

  const openForeshadowMenu = () => setShowForeshadowMenu((v) => !v)

  const onNewForeshadow = () => {
    const content = window.prompt('伏笔内容：')
    if (content?.trim()) void addForeshadow(content.trim(), subId, line.id)
    setShowForeshadowMenu(false)
  }

  const onResolveForeshadow = (fid: string) => {
    void markForeshadow(fid, subId, line.id)
    setShowForeshadowMenu(false)
  }

  const openForeshadows = foreshadows.filter((f) => f.status === 'open')

  return (
    <div className={`line-row ${isScene ? 'scene-line' : ''} ${isNarration ? 'narration-line' : ''}`}>
      <span className={`line-no ${isScene ? 'scene' : ''}`} title={isScene ? '场景' : isNarration ? '旁白' : '对白'}>
        {index + 1}
      </span>
      <div className="line-main">
        {isDialogue && (
          <>
            <CharacterPicker
              items={characters}
              valueName={charName}
              listId={`dl-fchar-${line.id}`}
              onCommit={(cid, cname) => onChange({ characterId: cid, characterName: cname })}
            />
            <select className="line-expr" value={expression} onChange={(e) => onChange({ expression: e.target.value })}>
              <option value="">默认表情</option>
              {['默认', '微笑', '生气', '悲伤', '惊讶', '脸红'].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </>
        )}
        {isScene && (
          <ScenePicker
            items={scenes}
            valueName={sceneName}
            listId={`dl-fscene-${line.id}`}
            onCommit={(sid, sname) => onChange({ sceneId: sid, sceneName: sname })}
          />
        )}
        {isDialogue && <input className="line-text" value={draft} placeholder="对白…" onChange={(e) => onDraftChange(e.target.value)} onBlur={flushText} />}
        {isNarration && <input className="line-text" value={draft} placeholder="旁白…" onChange={(e) => onDraftChange(e.target.value)} onBlur={flushText} />}
      </div>
      {plantedHere.length > 0 && (
        <span className="line-fs-anchor planted" title={plantedTitle}>🚩</span>
      )}
      {resolvedHere.length > 0 && (
        <span className="line-fs-anchor resolved" title={resolvedTitle}>✅</span>
      )}
      <div className="line-actions">
        <button title="上移" onClick={() => { flushText(); onMove(-1) }}>▲</button>
        <button title="下移" onClick={() => { flushText(); onMove(1) }}>▼</button>
        <button className="line-foreshadow" title="新建伏笔 / 回收伏笔" onClick={openForeshadowMenu}>＋</button>
        <button title="删除" className="line-delete" onClick={() => { if (window.confirm('删除这行？')) onDelete() }}>✕</button>
      </div>

      {showForeshadowMenu && (
        <div className="foreshadow-menu">
          <button className="fs-menu-item primary" onClick={onNewForeshadow}>＋ 新建伏笔</button>
          {openForeshadows.length > 0 && <div className="fs-menu-divider">回收伏笔：</div>}
          {openForeshadows.map((f) => (
            <button key={f.id} className="fs-menu-item" onClick={() => onResolveForeshadow(f.id)} title={f.content}>
              {f.content.slice(0, 20)}
            </button>
          ))}
          {openForeshadows.length === 0 && <div className="fs-menu-empty">（没有未回收的伏笔）</div>}
        </div>
      )}
    </div>
  )
}
