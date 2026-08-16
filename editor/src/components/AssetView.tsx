import type { Character, Project, Scene } from '@storyforge/shared'
import { mediaUrl } from '../api'

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
      {first && <img className="scene-img" src={mediaUrl(first.assetPath)} alt={scene.name} loading="lazy" />}
    </div>
  )
}

export function AssetView({ project }: { project: Project }) {
  return (
    <div className="asset-view">
      <h1>资产库</h1>
      <section>
        <h2>角色</h2>
        <div className="grid">
          {project.characters.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      </section>
      <section>
        <h2>场景</h2>
        <div className="grid">
          {project.scenes.map((s) => (
            <SceneCard key={s.id} scene={s} />
          ))}
        </div>
      </section>
    </div>
  )
}
