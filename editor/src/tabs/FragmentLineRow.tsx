import type { Character, Scene, ScriptLine } from '@storyforge/shared'
import type { LineIn } from '../api'
import { useEditorStore } from '../store'
import { LineRowInner } from './LineRowInner'

interface FragmentLineRowProps {
  subId: string
  line: ScriptLine
  /** 行号（从 0 开始），显示为序号 */
  index: number
  characters: Character[]
  scenes: Scene[]
  onChange: (patch: Record<string, unknown>) => void
  onDelete: () => void
  onMove: (delta: number) => void
  onInsert: (data: LineIn) => void
  onDuplicate: (data: LineIn) => void
}

/** 子片段行：行内编辑逻辑复用 LineRowInner，操作通过回调交给 FragmentEditor */
export function FragmentLineRow({ subId, line, index, characters, scenes, onChange, onDelete, onMove, onInsert, onDuplicate }: FragmentLineRowProps) {
  const { focusLineId, setFocusLine } = useEditorStore()

  return (
    <LineRowInner
      subId={subId}
      line={line}
      index={index}
      characters={characters}
      scenes={scenes}
      onEdit={onChange}
      onDelete={onDelete}
      onMove={onMove}
      onInsert={onInsert}
      onDuplicate={onDuplicate}
      shouldFocus={focusLineId === line.id}
      onFocusClaimed={() => setFocusLine(null)}
    />
  )
}
