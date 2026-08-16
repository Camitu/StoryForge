import type { Beat, Character, Scene, Section } from '@storyforge/shared'
import { useEditorStore } from '../store'

function beatKindLabel(beat: Beat): string {
  switch (beat.kind) {
    case 'dialogue':
      return '对白'
    case 'narration':
      return '旁白'
    case 'scene':
      return '切场景'
    case 'character':
      return '立绘'
    case 'bgm':
      return 'BGM'
    case 'sfx':
      return '音效'
    case 'choice':
      return '分支'
    case 'jump':
      return '跳转'
    case 'curtain':
      return '黑幕'
    case 'end':
      return '结束'
  }
}

function beatSummary(beat: Beat): string {
  switch (beat.kind) {
    case 'dialogue':
      return `${beat.characterId} [${beat.expression || '默认'}]：${beat.text}`
    case 'narration':
      return beat.text
    case 'scene':
      return `切场景 → ${beat.sceneId}`
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
    case 'character':
      return `立绘 ${beat.op} ${beat.characterId}`
    case 'end':
      return '结束'
  }
}

export function SectionEditor({ section }: { section: Section }) {
  const { project, updateSection, saveCurrent, saving, addBeat, updateBeat, deleteBeat, moveBeat } =
    useEditorStore()

  if (!project) return null
  const characters = project.characters
  const scenes = project.scenes
  const tagsText = section.tags?.join(', ') ?? ''

  const addDialogue = () => {
    addBeat(section.id, {
      id: crypto.randomUUID(),
      kind: 'dialogue',
      time: section.time,
      characterId: characters[0]?.id ?? '',
      expression: '',
      text: '',
      sprite: null,
      avatar: null,
      sceneId: null,
      cg: null,
    })
  }

  const addNarration = () => {
    addBeat(section.id, { id: crypto.randomUUID(), kind: 'narration', time: section.time, text: '' })
  }

  const addScene = () => {
    addBeat(section.id, {
      id: crypto.randomUUID(),
      kind: 'scene',
      time: section.time,
      sceneId: scenes[0]?.id ?? '',
    })
  }

  return (
    <div className="section-editor">
      <h2>小节</h2>
      <div className="row">
        <div className="col">
          <label className="field-label">名称</label>
          <input
            className="input"
            value={section.name}
            onChange={(e) => updateSection(section.id, { name: e.target.value })}
          />
        </div>
        <div className="col">
          <label className="field-label">时间</label>
          <input
            className="input"
            value={section.time}
            onChange={(e) => updateSection(section.id, { time: e.target.value })}
          />
        </div>
      </div>

      <label className="field-label">剧情概要（写作指引）</label>
      <textarea
        className="textarea"
        rows={4}
        value={section.summary}
        placeholder="尽量涵盖本小节全部剧情…"
        onChange={(e) => updateSection(section.id, { summary: e.target.value })}
      />

      <label className="field-label">标签（逗号分隔）</label>
      <input
        className="input"
        value={tagsText}
        placeholder="日常, 重逢"
        onChange={(e) =>
          updateSection(section.id, {
            tags: e.target.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          })
        }
      />

      <label className="field-label">剧情浓缩（压缩上下文）</label>
      <textarea
        className="textarea"
        rows={3}
        value={section.condense?.summary ?? ''}
        placeholder="（暂无浓缩，可由 AI 生成）只记录会影响后续的关键点…"
        onChange={(e) => {
          const prev = section.condense
          updateSection(section.id, {
            condense: prev
              ? { ...prev, summary: e.target.value }
              : {
                  sectionId: section.id,
                  characterStateChanges: {},
                  flagChanges: {},
                  foreshadowsPlanted: [],
                  foreshadowsResolved: [],
                  summary: e.target.value,
                  keyPoints: [],
                  tags: [],
                },
          })
        }}
      />

      <label className="field-label">Beat（{section.beats.length}）</label>
      <div className="beat-toolbar">
        <button className="add-btn" onClick={addDialogue}>
          ＋ 对白
        </button>
        <button className="add-btn" onClick={addNarration}>
          ＋ 旁白
        </button>
        <button className="add-btn" onClick={addScene}>
          ＋ 切场景
        </button>
      </div>
      <div className="beat-list">
        {section.beats.map((beat, i) => (
          <BeatRow
            key={beat.id ?? i}
            beat={beat}
            index={i}
            count={section.beats.length}
            characters={characters}
            scenes={scenes}
            onChange={(patch) => updateBeat(section.id, i, patch)}
            onDelete={() => deleteBeat(section.id, i)}
            onMove={(dir) => moveBeat(section.id, i, dir)}
          />
        ))}
      </div>

      <button className="save-btn section-save" onClick={saveCurrent} disabled={saving}>
        {saving ? '保存中…' : '保存小节'}
      </button>
    </div>
  )
}

function BeatRow({
  beat,
  index,
  count,
  characters,
  scenes,
  onChange,
  onDelete,
  onMove,
}: {
  beat: Beat
  index: number
  count: number
  characters: Character[]
  scenes: Scene[]
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  return (
    <div className="beat-row">
      <div className="beat-head">
        <span className="beat-kind">{beatKindLabel(beat)}</span>
        <span className="beat-actions">
          <button disabled={index === 0} title="上移" onClick={() => onMove(-1)}>
            ▲
          </button>
          <button disabled={index === count - 1} title="下移" onClick={() => onMove(1)}>
            ▼
          </button>
          <button className="danger" title="删除" onClick={onDelete}>
            ✕
          </button>
        </span>
      </div>

      {beat.kind === 'dialogue' && (
        <div className="beat-body">
          <select value={beat.characterId} onChange={(e) => onChange({ characterId: e.target.value, expression: '' })}>
            <option value="">选择角色</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={beat.expression} onChange={(e) => onChange({ expression: e.target.value })}>
            <option value="">默认表情</option>
            {characters
              .find((c) => c.id === beat.characterId)
              ?.expressions.map((exp) => (
                <option key={exp.name} value={exp.name}>
                  {exp.name}
                </option>
              ))}
          </select>
          <input
            className="beat-text"
            value={beat.text}
            placeholder="对白…"
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
      )}

      {beat.kind === 'narration' && (
        <div className="beat-body">
          <input
            className="beat-text"
            value={beat.text}
            placeholder="旁白…"
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </div>
      )}

      {beat.kind === 'scene' && (
        <div className="beat-body">
          <select value={beat.sceneId} onChange={(e) => onChange({ sceneId: e.target.value })}>
            <option value="">选择场景</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!['dialogue', 'narration', 'scene'].includes(beat.kind) && (
        <div className="beat-body muted">{beatSummary(beat)}</div>
      )}
    </div>
  )
}
