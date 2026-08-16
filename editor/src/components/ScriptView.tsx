import { useState } from 'react'
import type { Project, SubChapter } from '@storyforge/shared'
import { useEditorStore } from '../store'
import { SectionEditor } from './SectionEditor'

export function ScriptView({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(project.chapterOrder))
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const { updateSubChapter, addChapter, addSubChapter, addSection } = useEditorStore()

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedSub = selectedSubId
    ? project.chapters.flatMap((c) => c.subChapters).find((sc) => sc.id === selectedSubId) ?? null
    : null

  const selectedSection = selectedSectionId
    ? project.chapters
        .flatMap((c) => c.subChapters)
        .flatMap((sc) => sc.sections)
        .find((s) => s.id === selectedSectionId) ?? null
    : null

  // 时间线
  const timeline: { id: string; chapter: string; subChapter: string; section: string; time: string }[] = []
  for (const cid of project.chapterOrder) {
    const chapter = project.chapters.find((c) => c.id === cid)
    if (!chapter) continue
    for (const sub of chapter.subChapters) {
      for (const section of sub.sections) {
        timeline.push({ id: section.id, chapter: chapter.name, subChapter: sub.name, section: section.name, time: section.time })
      }
    }
  }

  const selectSub = (id: string) => {
    setSelectedSubId(id)
    setSelectedSectionId(null)
  }

  const selectSection = (id: string) => {
    setSelectedSectionId(id)
  }

  return (
    <div className="script-view">
      <div className="tree-panel">
        <h1>脚本总览</h1>
        <button
          className="add-btn add-chapter"
          onClick={() => {
            const name = window.prompt('大章节名', '新章节')
            if (name) addChapter(name)
          }}
        >
          ＋ 大章节
        </button>
        {project.chapterOrder.map((cid) => {
          const chapter = project.chapters.find((c) => c.id === cid)
          if (!chapter) return null
          const open = expanded.has(chapter.id)
          return (
            <div key={chapter.id} className="chapter-node">
              <div className="node-row chapter" onClick={() => toggle(chapter.id)}>
                <span className="caret">{open ? '▾' : '▸'}</span>
                <span className="node-name">{chapter.name}</span>
                <span className="node-meta">{chapter.subChapters.length} 子章节</span>
                <button
                  className="add-btn"
                  title="新建子章节"
                  onClick={(e) => {
                    e.stopPropagation()
                    const name = window.prompt('子章节名', '新子章节')
                    if (name) addSubChapter(chapter.id, name)
                  }}
                >
                  ＋
                </button>
              </div>
              {open &&
                chapter.subChapters.map((sub) => (
                  <div
                    key={sub.id}
                    className={`node-row subchapter ${sub.id === selectedSubId ? 'selected' : ''}`}
                    onClick={() => selectSub(sub.id)}
                  >
                    <span className="node-name">{sub.name}</span>
                    <span className="node-meta">{sub.sections.length} 小节</span>
                  </div>
                ))}
            </div>
          )
        })}
      </div>

      <aside className="detail-panel">
        {selectedSection ? (
          <SectionEditor section={selectedSection} />
        ) : selectedSub ? (
          <SubChapterPanel
            sub={selectedSub}
            onSelectSection={selectSection}
            onUpdate={updateSubChapter}
            onAddSection={addSection}
          />
        ) : (
          <>
            <h3>时间线</h3>
            {timeline.map((t) => (
              <div key={t.id} className="timeline-item">
                <div className="tl-time">{t.time}</div>
                <div className="tl-name">{t.section}</div>
                <div className="tl-path">
                  {t.chapter} / {t.subChapter}
                </div>
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  )
}

function SubChapterPanel({
  sub,
  onSelectSection,
  onUpdate,
  onAddSection,
}: {
  sub: SubChapter
  onSelectSection: (id: string) => void
  onUpdate: (id: string, patch: Partial<SubChapter>) => void
  onAddSection: (subChapterId: string, name: string) => void
}) {
  return (
    <div className="subchapter-panel">
      <h2>子章节</h2>
      <input
        className="input title-input"
        value={sub.name}
        onChange={(e) => onUpdate(sub.id, { name: e.target.value })}
      />
      <label className="field-label">概要</label>
      <textarea
        className="textarea"
        rows={3}
        value={sub.summary ?? ''}
        placeholder="子章节概要…"
        onChange={(e) => onUpdate(sub.id, { summary: e.target.value })}
      />
      <h3 className="sections-title">小节（{sub.sections.length}）</h3>
      <button
        className="add-btn"
        onClick={() => {
          const name = window.prompt('小节名', '新小节')
          if (name) onAddSection(sub.id, name)
        }}
      >
        ＋ 小节
      </button>
      {sub.sections.map((section) => (
        <div key={section.id} className="section-row" onClick={() => onSelectSection(section.id)}>
          <span className="section-row-name">{section.name}</span>
          <span className="section-row-meta">
            {section.time} · {section.beats.length} beat
          </span>
        </div>
      ))}
    </div>
  )
}
