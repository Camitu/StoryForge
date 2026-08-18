import type { Character, ExternalBlock, Scene, ScriptLine } from '@storyforge/shared'
import { withExternalBlocks } from './ExternalBlockRow'

/** 只读行渲染（标准写作预览）：序号 + 角色/表情/文本，去掉输入框与下拉框；含外部演出块占位 */
export function LinePreview({ lines, externalBlocks, characters, scenes }: {
  lines: ScriptLine[]
  externalBlocks?: ExternalBlock[]
  characters: Character[]
  scenes: Scene[]
}) {
  const charName = (id: string) => characters.find((c) => c.id === id)?.name ?? id
  const sceneName = (id?: string | null) => {
    if (!id) return ''
    return scenes.find((s) => s.id === id)?.name ?? id
  }

  if (lines.length === 0 && (externalBlocks?.length ?? 0) === 0) {
    return <div className="empty-hint">（本章节暂无内容）</div>
  }

  return (
    <div className="line-preview">
      {withExternalBlocks(lines, externalBlocks, (line, i) => (
        <div key={line.id} className={`preview-line preview-line-${line.kind}`}>
          <span className="preview-no">{i + 1}</span>
          {line.kind === 'dialogue' && (
            <>
              <span className="preview-char">{charName(line.characterId)}</span>
              {line.expression && <span className="preview-expr">（{line.expression}）</span>}
              <span className="preview-text">{line.text}</span>
            </>
          )}
          {line.kind === 'narration' && (
            <span className="preview-narration">{line.text}</span>
          )}
          {line.kind === 'scene' && (
            <div className="preview-scene">— 场景：{sceneName(line.sceneId)} —</div>
          )}
        </div>
      ))}
    </div>
  )
}
