import { useState } from 'react'
import type { Character, Scene, SubChapter, SubFragment } from '@storyforge/shared'
import type { LineIn } from '../api'
import { useEditorStore } from '../store'
import { FragmentLineRow } from './FragmentLineRow'
import { LinePreview } from './LinePreview'
import { withExternalBlocks } from './ExternalBlockRow'
import { confirmDialog } from '../ui/dialog'

/** 子片段独立编辑视图（标准写作）：把片段当作「从属父章节的子章节」编辑 */
export function FragmentEditor({ sub, fragment, characters, scenes }: {
  sub: SubChapter
  fragment: SubFragment
  characters: Character[]
  scenes: Scene[]
}) {
  const { renameFragment, removeFragment, addFragmentLine, editFragmentLine, removeFragmentLine, shiftFragmentLine, preview } = useEditorStore()
  const [fragName, setFragName] = useState(fragment.name)

  const onSaveName = () => {
    const name = fragName.trim()
    if (!name) {
      setFragName(fragment.name)
      return
    }
    if (name !== fragment.name) void renameFragment(sub.id, fragment.id, name)
  }

  const addLine = (kind: 'dialogue' | 'narration' | 'scene') => {
    const data: LineIn = kind === 'dialogue'
      ? { kind, characterId: characters[0]?.id ?? '', characterName: characters[0]?.name ?? '', text: '' }
      : kind === 'narration'
        ? { kind, text: '' }
        : { kind, sceneId: scenes[0]?.id ?? '', sceneName: scenes[0]?.name ?? '' }
    void addFragmentLine(sub.id, fragment.id, data)
  }

  const onDelete = async () => {
    const ok = await confirmDialog({ title: `删除子片段「${fragment.name}」？`, message: '删除后 LetsGal 中的对应 fragment 将不再被同步。', okText: '删除', danger: true })
    if (ok) await removeFragment(sub.id, fragment.id)
  }

  return (
    <div className="sub-editor">
      <div className="sub-editor-head">
        <input
          className="input sub-title-input"
          value={fragName}
          placeholder="片段名称"
          onChange={(e) => setFragName(e.target.value)}
          onBlur={onSaveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          disabled={preview}
        />
        {!preview && (
          <button className="danger-btn" onClick={() => void onDelete()}>删除片段</button>
        )}
      </div>
      {preview ? (
        <LinePreview lines={fragment.lines} externalBlocks={fragment.externalBlocks} characters={characters} scenes={scenes} />
      ) : (
        <>
          <div className="line-toolbar">
            <span className="line-count">片段内容（{fragment.lines.length} 行）</span>
            <button className="add-btn" onClick={() => addLine('dialogue')}>＋ 对白</button>
            <button className="add-btn" onClick={() => addLine('narration')}>＋ 旁白</button>
            <button className="add-btn" onClick={() => addLine('scene')}>＋ 切场景</button>
          </div>
          <div className="line-list">
            {withExternalBlocks(fragment.lines, fragment.externalBlocks, (line, i) => (
              <FragmentLineRow
                key={line.id}
                subId={sub.id}
                line={line}
                index={i}
                characters={characters}
                scenes={scenes}
                onChange={(patch) => void editFragmentLine(sub.id, fragment.id, line.id, { kind: line.kind, ...patch } as LineIn)}
                onDelete={() => void removeFragmentLine(sub.id, fragment.id, line.id)}
                onMove={(delta) => void shiftFragmentLine(sub.id, fragment.id, line.id, delta)}
                onInsert={(data) => void addFragmentLine(sub.id, fragment.id, data)}
                onDuplicate={(data) => void addFragmentLine(sub.id, fragment.id, data)}
              />
            ))}
            {fragment.lines.length === 0 && (fragment.externalBlocks?.length ?? 0) === 0 && <div className="empty-hint">还没有内容，点击上方按钮添加</div>}
          </div>
        </>
      )}
    </div>
  )
}
