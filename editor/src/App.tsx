import { useEffect, useState } from 'react'
import { useEditorStore } from './store'
import { mediaUrl } from './api'
import type { Beat, Character, Scene } from '@storyforge/shared'

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

function CharacterCard({ character }: { character: Character }) {
  return (
    <div className="card">
      <h4>{character.name}</h4>
      <div className="expressions">
        {character.expressions.map((exp) => (
          <figure key={exp.name} className="expr">
            <img src={mediaUrl(exp.assetPath)} alt={exp.name} loading="lazy" />
            <figcaption>{exp.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function SceneCard({ scene }: { scene: Scene }) {
  const first = scene.layers[0]
  return (
    <div className="card">
      <h4>{scene.name}</h4>
      {first && (
        <img className="scene-img" src={mediaUrl(first.assetPath)} alt={scene.name} loading="lazy" />
      )}
    </div>
  )
}

export default function App() {
  const { projects, project, saving, error, refreshProjects, loadProject, saveCurrent } = useEditorStore()
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    refreshProjects().then((list) => {
      if (list.length > 0) {
        setSelectedId(list[0].id)
        loadProject(list[0].id)
      }
    })
  }, [refreshProjects, loadProject])

  const onSelect = (id: string) => {
    setSelectedId(id)
    loadProject(id)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>工程</h2>
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id} className={p.id === selectedId ? 'active' : ''} onClick={() => onSelect(p.id)}>
              {p.name}
            </li>
          ))}
        </ul>
        {project && (
          <button className="save-btn" onClick={saveCurrent} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </aside>

      <main className="content">
        {!project ? (
          <div className="loading">加载中…</div>
        ) : (
          <>
            <header className="app-header">
              <h1>{project.name}</h1>
              <p className="meta">
                v{project.version} · {project.resolution.width}×{project.resolution.height} · {project.characters.length} 角色 · {project.scenes.length} 场景
              </p>
            </header>

            <section>
              <h3>角色</h3>
              <div className="grid">
                {project.characters.map((c) => (
                  <CharacterCard key={c.id} character={c} />
                ))}
              </div>
            </section>

            <section>
              <h3>场景</h3>
              <div className="grid">
                {project.scenes.map((s) => (
                  <SceneCard key={s.id} scene={s} />
                ))}
              </div>
            </section>

            <section>
              <h3>剧本</h3>
              {project.chapterOrder.map((cid) => {
                const chapter = project.chapters.find((c) => c.id === cid)
                if (!chapter) return null
                return (
                  <div key={chapter.id} className="chapter">
                    <h4>{chapter.name}</h4>
                    {chapter.sections.map((section) => (
                      <div key={section.id} className="section">
                        <h5>
                          {section.name} <span className="time">({section.time})</span>
                        </h5>
                        <ul className="beats">
                          {section.beats.map((beat, i) => (
                            <li key={beat.id ?? i}>{beatSummary(beat)}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
