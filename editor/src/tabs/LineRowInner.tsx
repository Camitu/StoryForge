import { useEffect, useMemo, useRef, useState } from 'react'
import type { Chapter, Character, Scene, ScriptLine, SubChapter } from '@storyforge/shared'
import type { LineIn } from '../api'
import { useEditorStore } from '../store'
import { CharacterPicker, ScenePicker } from './Pickers'
import { confirmDialog, promptDialog } from '../ui/dialog'

const TEXT_SAVE_DELAY = 800 // 停止输入 0.8s 后自动保存
const EXPR_SAVE_DELAY = 500 // 表情输入防抖（避免每次按键 PUT + 重渲染打断输入法）

/**
 * 收集【当前角色】在全部剧情（含子片段）中已使用的表情：
 * 只统计该角色自己的对白行，按使用频率降序返回去重列表。
 * 未使用过表情的角色返回空数组（下拉不显示，仅自由输入）。
 */
function collectExpressions(chapters: Chapter[], charId: string): string[] {
  if (!charId) return []
  const count = new Map<string, number>()

  const walkLines = (lines: ScriptLine[]) => {
    for (const l of lines) {
      if (l.kind !== 'dialogue') continue
      if (l.characterId !== charId) continue // 只看当前角色
      const expr = l.expression
      if (!expr) continue
      count.set(expr, (count.get(expr) ?? 0) + 1)
    }
  }
  const walkSub = (sub: SubChapter) => {
    walkLines(sub.lines)
    for (const frag of sub.fragments) walkLines(frag.lines)
  }
  for (const ch of chapters) for (const sub of ch.subChapters) walkSub(sub)

  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
}

export interface LineRowInnerProps {
  subId: string
  line: ScriptLine
  index: number
  characters: Character[]
  scenes: Scene[]
  /** 编辑行字段（文本/角色/表情/场景） */
  onEdit: (patch: Record<string, unknown>) => void
  /** 删除本行（确认已在内部完成） */
  onDelete: () => void
  /** 移动本行 */
  onMove: (delta: number) => void
  /** 在本行之后插入新行 */
  onInsert: (data: LineIn) => void
  /** 复制本行到之后 */
  onDuplicate: (data: LineIn) => void
  /** 本行是否应自动聚焦（新增行后光标落位） */
  shouldFocus: boolean
  /** 聚焦完成后清空 store 标记 */
  onFocusClaimed: () => void
}

/**
 * 标准写作行编辑器（主内容行与子片段行共用）：
 * - 对白/旁白为自适应高度 textarea（Shift+Enter 软换行）
 * - Enter 新建同类型行并聚焦；Ctrl+Enter 新建旁白；Alt+Enter 新建对白
 * - Alt+↑/↓ 移动行；Alt+Delete 删除行；Alt+E 循环表情；复制按钮
 * - 文本本地缓冲 + 防抖自动保存（打字不卡），卸载时 flush 不丢内容
 * - 外部更新（反向同步）无本地改动时同步到草稿
 */
export function LineRowInner({
  subId, line, index, characters, scenes,
  onEdit, onDelete, onMove, onInsert, onDuplicate,
  shouldFocus, onFocusClaimed,
}: LineRowInnerProps) {
  const { addForeshadow, markForeshadow, foreshadows, saveSignal, chapters } = useEditorStore()
  const [showForeshadowMenu, setShowForeshadowMenu] = useState(false)
  const [showExprDropdown, setShowExprDropdown] = useState(false)
  const exprWrapRef = useRef<HTMLSpanElement>(null)

  const isDialogue = line.kind === 'dialogue'
  const isNarration = line.kind === 'narration'
  const isScene = line.kind === 'scene'

  const text = 'text' in line ? line.text : ''
  const charId = 'characterId' in line ? line.characterId : ''
  const charName = 'characterName' in line ? (line.characterName ?? '') : ''
  const expression = 'expression' in line ? (line.expression ?? '') : ''
  const sceneId = 'sceneId' in line ? line.sceneId ?? '' : ''
  const sceneName = 'sceneName' in line ? (line.sceneName ?? '') : ''

  // 表情候选池（仅当前角色已用表情，按频率排序），随章节/角色变化更新
  const expressionOptions = useMemo(
    () => (isDialogue ? collectExpressions(chapters, charId) : []),
    [chapters, charId, isDialogue],
  )

  // ---- 文本本地缓冲 + 防抖保存 ----
  const [draft, setDraft] = useState(text)
  const draftRef = useRef(draft)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 最近一次已提交到服务端的文本（判断是否有本地未提交修改） */
  const lastCommittedRef = useRef(text)
  /** 始终指向最新 prop 文本（避免卸载 flush 读到陈旧闭包） */
  const textRef = useRef(text)
  textRef.current = text
  /** 行删除标记：确认删除后置位，卸载/防抖 flush 跳过，避免 PUT 已删除的行触发 404 */
  const deletedRef = useRef(false)

  const commitText = (value: string) => {
    if (value === textRef.current) return
    lastCommittedRef.current = value
    onEdit({ text: value })
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
      if (!deletedRef.current) commitText(value)
    }, TEXT_SAVE_DELAY)
  }

  // 卸载（切换章节/片段）时 flush，避免丢内容（已删除的行跳过）
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!deletedRef.current && draftRef.current !== textRef.current) commitText(draftRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 全局「保存」/ Ctrl+S 时强制 flush 未到防抖时间的草稿
  useEffect(() => {
    if (saveSignal > 0) flushText()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  // 外部更新（反向同步/其他端修改）同步到草稿：仅当没有本地未提交修改时采纳
  useEffect(() => {
    if (text !== draftRef.current && draftRef.current === lastCommittedRef.current) {
      setDraft(text)
      draftRef.current = text
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  // ---- 表情本地缓冲 + 防抖提交（避免每次按键 PUT + 重渲染打断输入法） ----
  const [exprDraft, setExprDraft] = useState(expression)
  const exprTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 最近一次已提交到服务端的表情 */
  const exprCommittedRef = useRef(expression)
  /** 始终指向最新草稿（卸载 flush 避免陈旧闭包） */
  const exprDraftRef = useRef(expression)
  exprDraftRef.current = exprDraft

  const commitExpr = (value: string) => {
    if (value === exprCommittedRef.current) return
    exprCommittedRef.current = value
    onEdit({ expression: value })
  }

  const flushExpr = () => {
    if (exprTimerRef.current) {
      clearTimeout(exprTimerRef.current)
      exprTimerRef.current = null
    }
    commitExpr(exprDraftRef.current)
  }

  const onExprChange = (value: string) => {
    setExprDraft(value)
    exprDraftRef.current = value
    if (exprTimerRef.current) clearTimeout(exprTimerRef.current)
    exprTimerRef.current = setTimeout(() => {
      exprTimerRef.current = null
      commitExpr(value)
    }, EXPR_SAVE_DELAY)
  }

  // 卸载时 flush 表情（不丢内容）
  useEffect(() => () => {
    if (exprTimerRef.current) clearTimeout(exprTimerRef.current)
    if (exprDraftRef.current !== exprCommittedRef.current) commitExpr(exprDraftRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部更新同步到表情草稿（无本地未提交改动时）
  useEffect(() => {
    if (expression !== exprDraftRef.current && exprDraftRef.current === exprCommittedRef.current) {
      setExprDraft(expression)
      exprDraftRef.current = expression
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression])

  // ---- 对白/旁白 textarea 高度自适应 ----
  const taRef = useRef<HTMLTextAreaElement>(null) as React.MutableRefObject<HTMLTextAreaElement | null>
  useEffect(() => {
    const el = taRef.current
    if (el) {
      el.style.height = 'auto'
      // 全局 box-sizing: border-box：scrollHeight 不含上下边框，需补偿，
      // 否则内容区被边框挤小 1-2px → 单行时也常显滚动条
      const border = el.offsetHeight - el.clientHeight
      el.style.height = el.scrollHeight + border + 'px'
    }
  }, [draft])

  // ---- 聚焦主元素（新增行光标落位） ----
  const primaryRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null) as React.MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>
  useEffect(() => {
    if (!shouldFocus) return
    onFocusClaimed()
    const el = primaryRef.current
    if (el) {
      el.focus({ preventScroll: false })
      el.select()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFocus])

  // ---- 插入/复制数据构建（afterId = 当前行，插入到本行之后） ----
  const buildInsert = (kind: 'dialogue' | 'narration' | 'scene'): LineIn => {
    if (kind === 'dialogue') {
      return { kind, characterId: charId, characterName: charName, expression: exprDraftRef.current, text: '', afterId: line.id }
    }
    if (kind === 'scene') {
      return { kind, sceneId, sceneName: sceneName || undefined, afterId: line.id }
    }
    return { kind, text: '', afterId: line.id }
  }

  const insertAfter = (kind: 'dialogue' | 'narration' | 'scene') => {
    flushText()
    onInsert(buildInsert(kind))
  }

  const duplicate = () => {
    flushText()
    const base = buildInsert(line.kind)
    const data: LineIn = line.kind === 'scene' ? base : { ...base, text: draftRef.current ?? '' }
    onDuplicate(data)
  }

  // 行删除标记：确认删除后置位，卸载/防抖 flush 跳过，避免 PUT 已删除的行触发 404
  const requestDelete = async () => {
    const ok = await confirmDialog({ title: '删除这行？', okText: '删除', danger: true })
    if (ok) {
      deletedRef.current = true
      onDelete()
    }
  }

  // ---- 行内快捷键（Alt 组合不依赖焦点在文本域） ----
  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('.foreshadow-menu')) return
    // 场景行：Enter 直接续一条场景（选择器内部 Enter 由 NamePicker 处理，不重复触发）
    if (
      e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.shiftKey && isScene &&
      !(e.target instanceof HTMLElement && e.target.closest('.picker-wrap'))
    ) {
      e.preventDefault()
      insertAfter('scene')
      return
    }
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      flushText()
      onMove(-1)
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      flushText()
      onMove(1)
    } else if (e.altKey && e.key === 'Delete') {
      e.preventDefault()
      void requestDelete()
    } else if (e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      cycleExpression()
    }
  }

  const cycleExpression = () => {
    if (!isDialogue) return
    // 循环候选：默认(空) → 动态候选池（当前角色常用优先）
    const list = ['', ...expressionOptions]
    const cur = exprDraftRef.current || ''
    const idx = list.indexOf(cur)
    const next = list[(idx + 1) % list.length]
    setExprDraft(next)
    exprDraftRef.current = next
    commitExpr(next)
  }

  // ---- 文本域 Enter 行为 ----
  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return // Shift+Enter = 段内软换行
    e.preventDefault()
    if (e.ctrlKey) insertAfter('narration')
    else if (e.altKey) insertAfter('dialogue')
    else insertAfter(line.kind)
  }

  // ---- 伏笔锚点 ----
  const plantedHere = foreshadows.filter((f) => f.plantedAt?.lineId === line.id)
  const resolvedHere = foreshadows.filter((f) => f.resolvedAt?.lineId === line.id)
  const plantedTitle = `本行埋设伏笔×${plantedHere.length}：${plantedHere.map((f) => `${f.content}${f.status === 'resolved' ? '（已回收）' : ''}`).join('；')}`
  const resolvedTitle = `本行回收伏笔×${resolvedHere.length}：${resolvedHere.map((f) => f.content).join('；')}`

  // 表情下拉面板外部点击自动关闭
  useEffect(() => {
    if (!showExprDropdown) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.expr-wrap')) setShowExprDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExprDropdown])

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

  const onNewForeshadow = async () => {
    const content = await promptDialog({ title: '新建伏笔', message: '伏笔内容（记录在当前行，可在「剧情伏笔与回收」Tab 统一管理）' })
    if (content?.trim()) void addForeshadow(content.trim(), subId, line.id)
    setShowForeshadowMenu(false)
  }

  const onResolveForeshadow = (fid: string) => {
    void markForeshadow(fid, subId, line.id)
    setShowForeshadowMenu(false)
  }

  const openForeshadows = foreshadows.filter((f) => f.status === 'open')

  return (
    <div
      className={`line-row ${isScene ? 'scene-line' : ''} ${isNarration ? 'narration-line' : ''}`}
      onKeyDown={onRowKeyDown}
    >
      <span className={`line-no ${isScene ? 'scene' : ''}`} title={isScene ? '场景' : isNarration ? '旁白' : '对白'}>
        {index + 1}
      </span>
      <div className="line-main">
        {isDialogue && (
          <>
            <CharacterPicker
              items={characters}
              valueName={charName}
              listId={`dl-char-${line.id}`}
              onCommit={(cid, cname) => onEdit({ characterId: cid, characterName: cname })}
            />
            <span className="expr-wrap" ref={exprWrapRef}>
              <input
                className="line-expr"
                value={exprDraft}
                placeholder="表情"
                onChange={(e) => onExprChange(e.target.value)}
                onBlur={() => { flushExpr(); setShowExprDropdown(false) }}
                onFocus={() => expressionOptions.length > 0 && setShowExprDropdown(true)}
                title="表情：可输入新表情；点 ▾ 从当前角色已用表情中选择（Alt+E 快速切换）"
              />
              {expressionOptions.length > 0 && (
                <button
                  type="button"
                  className="expr-drop-btn"
                  onClick={() => setShowExprDropdown((v) => !v)}
                  title="选择当前角色已用表情"
                >
                  ▾
                </button>
              )}
              {showExprDropdown && expressionOptions.length > 0 && (
                <div className="expr-dropdown">
                  {expressionOptions.map((x) => (
                    <button
                      key={x}
                      type="button"
                      className={`expr-drop-item ${x === exprDraft ? 'expr-drop-item-sel' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault() // 防止 input 失焦先关掉面板
                        setExprDraft(x)
                        exprDraftRef.current = x
                        commitExpr(x)
                        setShowExprDropdown(false)
                      }}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              )}
            </span>
          </>
        )}
        {isScene && (
          <ScenePicker
            items={scenes}
            valueName={sceneName}
            listId={`dl-scene-${line.id}`}
            inputRef={(el) => { if (isScene) primaryRef.current = el }}
            onCommit={(sid, sname) => onEdit({ sceneId: sid, sceneName: sname })}
          />
        )}
        {(isDialogue || isNarration) && (
          <textarea
            ref={(el) => { taRef.current = el; if (!isScene) primaryRef.current = el }}
            className="line-text line-textarea"
            rows={1}
            value={draft}
            placeholder={isDialogue ? '对白…' : '旁白…'}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onTextKeyDown}
            onBlur={flushText}
          />
        )}
        {isDialogue && !charName && (
          <span
            className="picker-warn"
            title="未选择角色：同步到 LetsGal 时会自动生成「未命名」占位角色。建议先选择或输入角色名。"
          >
            ⚠️
          </span>
        )}
      </div>
      {plantedHere.length > 0 && (
        <span className="line-fs-anchor planted" title={plantedTitle}>🚩</span>
      )}
      {resolvedHere.length > 0 && (
        <span className="line-fs-anchor resolved" title={resolvedTitle}>✅</span>
      )}
      <div className="line-actions">
        <button title="上移（Alt+↑）" onClick={() => { flushText(); onMove(-1) }}>▲</button>
        <button title="下移（Alt+↓）" onClick={() => { flushText(); onMove(1) }}>▼</button>
        <button title="复制行" onClick={duplicate}>⧉</button>
        <button className="line-foreshadow" title="新建伏笔 / 回收伏笔" onClick={openForeshadowMenu}>＋</button>
        <button className="line-delete" title="删除（Alt+Delete）" onClick={() => void requestDelete()}>✕</button>
      </div>

      {showForeshadowMenu && (
        <div className="foreshadow-menu">
          <button className="fs-menu-item primary" onClick={() => void onNewForeshadow()}>＋ 新建伏笔</button>
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
