import { useState } from 'react'
import type { Project } from '@storyforge/shared'

interface TimelineItem {
  id: string
  chapter: string
  subChapter: string
  section: string
  time: string
}

export function ScriptView({ project }: { project: Project }) {
  // 默认展开所有大章节
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(project.chapterOrder))

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 时间线：按顺序展平所有小节
  const timeline: TimelineItem[] = []
  for (const cid of project.chapterOrder) {
    const chapter = project.chapters.find((c) => c.id === cid)
    if (!chapter) continue
    for (const sub of chapter.subChapters) {
      for (const section of sub.sections) {
        timeline.push({
          id: section.id,
          chapter: chapter.name,
          subChapter: sub.name,
          section: section.name,
          time: section.time,
        })
      }
    }
  }

  return (
    <div className="script-view">
      <div className="tree-panel">
        <h1>脚本总览</h1>
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
              </div>
              {open &&
                chapter.subChapters.map((sub) => {
                  const subOpen = expanded.has(sub.id)
                  return (
                    <div key={sub.id} className="subchapter-node">
                      <div className="node-row subchapter" onClick={() => toggle(sub.id)}>
                        <span className="caret">{subOpen ? '▾' : '▸'}</span>
                        <span className="node-name">{sub.name}</span>
                        <span className="node-meta">{sub.sections.length} 小节</span>
                      </div>
                      {subOpen &&
                        sub.sections.map((section) => (
                          <div key={section.id} className="node-row section">
                            <span className="node-name">{section.name}</span>
                            <span className="node-meta">
                              {section.time} · {section.beats.length} beat
                            </span>
                          </div>
                        ))}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>

      <aside className="timeline-panel">
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
      </aside>
    </div>
  )
}
