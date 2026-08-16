import { useEffect } from 'react'
import { useEditorStore } from './store'
import sampleJson from '../../shared/examples/sample-project.json'
import type { Beat, Project } from '@storyforge/shared'

function beatSummary(beat: Beat): string {
  switch (beat.kind) {
    case 'dialogue':
      return `对白 [${beat.expression || '默认'}] ${beat.text}`
    case 'narration':
      return `旁白 ${beat.text}`
    case 'scene':
      return `切场景 → ${beat.sceneId}`
    case 'character':
      return `立绘 ${beat.op} ${beat.characterId}`
    case 'bgm':
      return `BGM ${beat.op} ${beat.uri ?? ''}`
    case 'sfx':
      return `音效 ${beat.uri}`
    case 'choice':
      return `分支 (${beat.options.length} 项)`
    case 'jump':
      return `跳转 → ${beat.target}`
    case 'curtain':
      return `黑幕 ${beat.op}`
    case 'end':
      return '结束'
  }
}

export default function App() {
  const project = useEditorStore((s) => s.project)
  const loadProject = useEditorStore((s) => s.loadProject)

  useEffect(() => {
    loadProject(sampleJson as unknown as Project)
  }, [loadProject])

  if (!project) return <div className="loading">加载中…</div>

  return (
    <div className="app">
      <header className="app-header">
        <h1>{project.name}</h1>
        <p className="meta">
          v{project.version} · {project.resolution.width}×{project.resolution.height} · {project.characters.length} 角色 · {project.scenes.length} 场景
        </p>
      </header>

      {project.chapterOrder.map((cid) => {
        const chapter = project.chapters.find((c) => c.id === cid)
        if (!chapter) return null
        return (
          <section key={chapter.id} className="chapter">
            <h2>{chapter.name}</h2>
            {chapter.summary && <p className="chapter-summary">{chapter.summary}</p>}
            {chapter.sections.map((section) => (
              <div key={section.id} className="section">
                <h3>
                  {section.name} <span className="time">({section.time})</span>
                </h3>
                <p className="summary">{section.summary}</p>
                <ul className="beats">
                  {section.beats.map((beat, i) => (
                    <li key={beat.id ?? i}>{beatSummary(beat)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
