import { Fragment, useMemo, useState, useEffect, useRef } from 'react'
import { useEditorStore, type ViewMode } from '../store'
import { SubChapterEditor } from './SubChapterEditor'
import { FragmentEditor } from './FragmentEditor'
import { FragmentFreeEditor } from './FragmentFreeEditor'
import { FreeEditor } from './FreeEditor'
import { EditPreviewToggle } from './EditPreviewToggle'
import { confirmDialog, promptDialog } from '../ui/dialog'
import { toast } from '../ui/toast'

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'standard', label: '标准写作' },
  { id: 'free', label: '自由写作' },
]

/** 章节写作管理 Tab：搜索 + 模式工具栏 + 时间轴/章节树（对齐）/正文（滚轮衔接上下章节） */
export function WritingTab() {
  const {
    chapters, characters, scenes, selectedSubId, setSelectedSub,
    viewMode, setViewMode, timelineVisible, toggleTimeline,
    collapsedChapters, toggleChapterCollapse, rememberSub,
    addChapter, saveChapter, removeChapter,
    addSub, shiftSub, removeSub, runSearch, clearSearch, searchResults, currentProjectId,
    addFragment, removeFragment, requestSave,
  } = useEditorStore()
  const [searchQ, setSearchQ] = useState('')
  const [editingChapter, setEditingChapter] = useState<string | null>(null)
  // 全局保存按钮反馈
  const [saveFeedback, setSaveFeedback] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 从章节树点击子片段时，编辑器自动展开对应片段
  const [focusFragmentId, setFocusFragmentId] = useState<string | null>(null)
  // 滚轮衔接：切换章节后滚动到顶部/底部
  const [scrollTarget, setScrollTarget] = useState<'top' | 'bottom'>('top')
  const paneRef = useRef<HTMLDivElement>(null)

  // 记忆上次编辑的小章节
  useEffect(() => {
    if (!currentProjectId || selectedSubId) return
    try {
      const last = localStorage.getItem(`sf_last_sub_${currentProjectId}`)
      if (last) {
        const exists = chapters.some((ch) => ch.subChapters.some((s) => s.id === last))
        if (exists) setSelectedSub(last)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, chapters.length])

  const selectedSub = useMemo(() => {
    for (const ch of chapters) {
      const sub = ch.subChapters.find((s) => s.id === selectedSubId)
      if (sub) return sub
    }
    return null
  }, [chapters, selectedSubId])

  // 树中点击子片段 → 右侧渲染独立片段编辑视图
  const focusedFragment = useMemo(() => {
    if (!selectedSub || !focusFragmentId) return null
    return selectedSub.fragments.find((f) => f.id === focusFragmentId) ?? null
  }, [selectedSub, focusFragmentId])

  // 按章节顺序展平（用于滚轮衔接上下章）
  const orderedSubs = useMemo(() => {
    const list: { id: string; name: string; chapterName: string }[] = []
    for (const ch of chapters) {
      for (const s of ch.subChapters) list.push({ id: s.id, name: s.name, chapterName: ch.name })
    }
    return list
  }, [chapters])

  const findPrevSub = (id: string | null) => {
    const idx = orderedSubs.findIndex((s) => s.id === id)
    return idx > 0 ? orderedSubs[idx - 1] : null
  }
  const findNextSub = (id: string | null) => {
    const idx = orderedSubs.findIndex((s) => s.id === id)
    return idx >= 0 && idx < orderedSubs.length - 1 ? orderedSubs[idx + 1] : null
  }

  // 切换章节后滚动定位
  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    if (scrollTarget === 'bottom') el.scrollTop = el.scrollHeight
    else el.scrollTop = 0
  }, [selectedSubId, focusFragmentId, scrollTarget])

  const selectSub = (id: string, target: 'top' | 'bottom' = 'top') => {
    setSelectedSub(id)
    rememberSub(id)
    setFocusFragmentId(null)
    setScrollTarget(target)
  }

  // 滚轮衔接：正文滚到顶 → 上一章末尾；滚到底 → 下一章头部
  // 用原生非 passive 监听，才能 preventDefault 阻止默认滚动（React onWheel 是 passive）
  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (focusedFragment) return // 片段视图内容少，不参与衔接
      const t = e.target as HTMLElement
      // 输入框/下拉框/文本域内滚动不拦截翻章（避免在文本框里滚轮误切上下章节）
      if (t.closest('input, select, textarea')) return
      const atTop = el.scrollTop <= 1
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if (e.deltaY < 0 && atTop) {
        const prev = findPrevSub(selectedSubId)
        if (prev) { e.preventDefault(); selectSub(prev.id, 'bottom') }
      } else if (e.deltaY > 0 && atBottom) {
        const next = findNextSub(selectedSubId)
        if (next) { e.preventDefault(); selectSub(next.id, 'top') }
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubId, orderedSubs, focusFragmentId])

  const onSaveAll = () => {
    requestSave()
    setSaveFeedback(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaveFeedback(false), 1500)
  }

  // 搜索防抖 300ms（避免每敲一个字符就请求一次全局搜索）
  useEffect(() => {
    const q = searchQ.trim()
    if (!q) {
      clearSearch()
      return
    }
    const t = setTimeout(() => void runSearch(q), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ])

  const gotoSearchResult = (subId: string | null, fragmentId?: string | null) => {
    if (!subId) return // 世界观/角色/场景/伏笔结果：只展示，不跳转
    setSelectedSub(subId)
    rememberSub(subId)
    setFocusFragmentId(fragmentId ?? null)
    setScrollTarget('top')
    setSearchQ('')
  }

  const onAddFragment = async (subId: string) => {
    const fname = await promptDialog({ title: '新建子片段', message: '子片段名（对应 LetsGal fragment，main 为保留名）', placeholder: '片段1', initial: '片段1' })
    if (fname?.trim()) void addFragment(subId, fname.trim())
  }

  const onDeleteFragment = async (subId: string, fid: string) => {
    const ok = await confirmDialog({ title: '删除这个子片段？', okText: '删除', danger: true })
    if (!ok) return
    await removeFragment(subId, fid)
    if (focusFragmentId === fid) setFocusFragmentId(null)
  }

  const onAddSub = async (chapterId: string) => {
    const name = await promptDialog({ title: '新建小章节', message: '小章节名（= LetsGal 章节名，需唯一）', placeholder: '新章节', initial: '新章节' })
    if (name?.trim()) void addSub(chapterId, { name: name.trim(), date: '', summary: '', tags: [], condense: '', mode: 'standard', freeText: '' })
  }

  const onAddChapter = async () => {
    const name = await promptDialog({ title: '新建大章节', placeholder: '新大章节', initial: '新大章节' })
    if (name?.trim()) void addChapter(name.trim())
  }

  return (
    <div className="writing-tab">
      {/* 顶部：搜索栏 */}
      <div className="writing-search">
        <div className="search-input-wrap">
          <input
            className="input search-input"
            placeholder="全局搜索：章节 / 台词 / 片段…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
        {searchQ.trim() && (
          <div className="search-results">
            {searchResults.length === 0 && <div className="search-empty">无结果</div>}
            {searchResults.map((r, i) => (
              <button
                key={r.subChapterId ? r.subChapterId : `${r.scope}-${i}`}
                className={`search-result-item ${!r.subChapterId ? 'search-result-static' : ''}`}
                onClick={() => gotoSearchResult(r.subChapterId, r.fragmentId)}
              >
                <span className="search-date">{r.scope === 'chapter' ? r.date : r.scope}</span>
                <span className="search-name">{r.chapterName} / {r.subChapterName}</span>
                <span className="search-hits">{r.hits.join('；')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 第二行：全局工具栏（居中）：时间轴 + 写作类型 + 编辑/预览 + 保存 */}
      <div className="writing-toolbar center">
        <button className={`toolbar-toggle ${timelineVisible ? 'on' : ''}`} onClick={toggleTimeline} title="显示/隐藏时间轴">
          ⏱ 时间轴
        </button>
        <div className="mode-group">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-btn ${viewMode === m.id ? 'active' : ''}`}
              onClick={() => setViewMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <EditPreviewToggle />
        <button className="primary-btn save-toolbar-btn" onClick={onSaveAll}>
          {saveFeedback ? '已保存 ✓' : '保存'}
        </button>
      </div>

      <div className="writing-layout">
        {/* 时间轴 + 章节树（同一 grid 完全对齐） */}
        <div className={`tree-timeline ${timelineVisible ? '' : 'no-timeline'}`}>
          {chapters.map((ch) => {
            const collapsed = collapsedChapters.has(ch.id)
            return (
              <div key={ch.id} className="tt-chapter">
                {/* 大章节行：全宽标题（覆盖时间轴区域）+ 右侧新建/删除 */}
                <div className="tt-row chapter-row-tt">
                  <div className="tt-tree-cell chapter-tree-cell">
                    <button
                      className="chapter-caret"
                      onClick={() => toggleChapterCollapse(ch.id)}
                      title={collapsed ? '展开' : '折叠'}
                    >
                      {collapsed ? '▸' : '▾'}
                    </button>
                    {editingChapter === ch.id ? (
                      <input
                        className="input inline-input"
                        defaultValue={ch.name}
                        autoFocus
                        onBlur={(e) => {
                          void saveChapter(ch.id, e.target.value || ch.name, ch.summary)
                          setEditingChapter(null)
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    ) : (
                      <span className="chapter-name" title="双击重命名" onDoubleClick={() => setEditingChapter(ch.id)}>
                        {ch.name}
                      </span>
                    )}
                    <span className="chapter-actions">
                      <button title="新建小章节" onClick={() => void onAddSub(ch.id)}>＋</button>
                      <button title="删除大章节" className="danger"
                        onClick={() => {
                          if (ch.subChapters.length > 0) {
                            toast('大章节下有小章节，请先移走或删除', 'error')
                            return
                          }
                          void confirmDialog({
                            title: `删除大章节「${ch.name}」？`,
                            okText: '删除',
                            danger: true,
                          }).then((ok) => { if (ok) void removeChapter(ch.id) })
                        }}>
                        ✕
                      </button>
                    </span>
                  </div>
                </div>

                {/* 小章节行（不折叠时）+ 子片段（缩进一级） */}
                {!collapsed && ch.subChapters.map((sub) => (
                  <Fragment key={`frags-${sub.id}`}>
                  <div key={sub.id} className={`tt-row sub-row-tt ${sub.id === selectedSubId ? 'active' : ''}`}>
                    {timelineVisible && (
                      <div
                        className="tt-tl-cell sub-tl clickable"
                        onClick={() => selectSub(sub.id)}
                        title={`${sub.date || '--'} · ${sub.name}`}
                      >
                        <span className="tl-date-label">{sub.date || '--'}</span>
                        <span className={`tl-dot ${sub.id === selectedSubId ? 'filled' : ''}`} />
                      </div>
                    )}
                    <div
                      className="tt-tree-cell sub-tree-cell"
                      onClick={() => selectSub(sub.id)}
                    >
                      <span className="sub-name">
                        {sub.name}
                        {sub.mode === 'free' && <span className="sub-mode-badge">自由</span>}
                      </span>
                      <span className="sub-actions">
                        <button title="上移" onClick={(e) => { e.stopPropagation(); void shiftSub(sub.id, -1) }}>▲</button>
                        <button title="下移" onClick={(e) => { e.stopPropagation(); void shiftSub(sub.id, 1) }}>▼</button>
                        <button title="新建子片段" onClick={(e) => { e.stopPropagation(); void onAddFragment(sub.id) }}>＋</button>
                        <button title="删除" className="danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            void confirmDialog({
                              title: `删除小章节「${sub.name}」？`,
                              message: '删除后 LetsGal 中的对应章节将不再被同步。',
                              okText: '删除',
                              danger: true,
                            }).then((ok) => { if (ok) void removeSub(sub.id) })
                          }}>
                          ✕
                        </button>
                      </span>
                    </div>
                  </div>

                  {/* 子片段行（仅比小章节多一级缩进，对应 LetsGal 章节内 fragment） */}
                  {sub.fragments.map((frag) => (
                    <div
                      key={frag.id}
                      className={`tt-row frag-row-tt ${sub.id === selectedSubId && focusFragmentId === frag.id ? 'active' : ''}`}
                    >
                      {timelineVisible && <div className="tt-tl-cell" />}
                      <div
                        className="tt-tree-cell frag-tree-cell"
                        onClick={() => {
                          setSelectedSub(sub.id)
                          rememberSub(sub.id)
                          setFocusFragmentId(frag.id)
                          setScrollTarget('top')
                        }}
                        title="点击定位到该片段"
                      >
                        <span className="frag-tree-prefix">└</span>
                        <span className="frag-tree-name">{frag.name}</span>
                        <span className="frag-tree-count">{frag.lines.length} 行</span>
                        <span className="frag-tree-actions" onClick={(e) => e.stopPropagation()}>
                          <button title="删除子片段" className="danger" onClick={() => void onDeleteFragment(sub.id, frag.id)}>✕</button>
                        </span>
                      </div>
                    </div>
                  ))}
                  </Fragment>
                ))}
              </div>
            )
          })}

          {/* 全局新建大章节（与标题同宽） */}
          <div className="tt-row add-chapter-row-tt">
            <div className="tt-tree-cell">
              <button
                className="add-sub-btn"
                onClick={() => void onAddChapter()}
              >
                ＋ 大章节
              </button>
            </div>
          </div>

          {chapters.length === 0 && (
            <div className="tt-row">
              {timelineVisible && <div className="tt-tl-cell" />}
              <div className="tt-tree-cell"><div className="empty-hint">还没有章节，点击下方新建</div></div>
            </div>
          )}
        </div>

        {/* 右侧正文（滚轮衔接上下章节） */}
        <div className="writing-editor-pane" ref={paneRef}>
          {focusedFragment && selectedSub && viewMode === 'standard' ? (
            <FragmentEditor
              key={focusedFragment.id}
              sub={selectedSub}
              fragment={focusedFragment}
              characters={characters}
              scenes={scenes}
            />
          ) : focusedFragment && selectedSub && viewMode === 'free' ? (
            <FragmentFreeEditor
              key={focusedFragment.id}
              sub={selectedSub}
              fragment={focusedFragment}
            />
          ) : selectedSub ? (
            viewMode === 'free' ? (
              <FreeEditor key={selectedSub.id} sub={selectedSub} />
            ) : (
              <SubChapterEditor
                key={selectedSub.id}
                sub={selectedSub}
                characters={characters}
                scenes={scenes}
              />
            )
          ) : (
            <div className="editor-placeholder">← 在左侧选择一个章节开始写作</div>
          )}
        </div>
      </div>
    </div>
  )
}
