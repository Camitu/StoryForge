import type { Beat, Section } from '@storyforge/shared'
import { useEditorStore } from '../store'

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

export function SectionEditor({ section }: { section: Section }) {
  const { updateSection, saveCurrent, saving } = useEditorStore()
  const tagsText = section.tags?.join(', ') ?? ''

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
      <ul className="beats">
        {section.beats.map((beat, i) => (
          <li key={beat.id ?? i}>{beatSummary(beat)}</li>
        ))}
      </ul>

      <button className="save-btn section-save" onClick={saveCurrent} disabled={saving}>
        {saving ? '保存中…' : '保存小节'}
      </button>
    </div>
  )
}
