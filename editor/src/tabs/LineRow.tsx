import type { Character, Scene, ScriptLine } from '@storyforge/shared'
import type { LineIn } from '../api'
import { useEditorStore } from '../store'
import { LineRowInner } from './LineRowInner'

/** 主内容行（小章节 lines）：封装 store 操作，行内编辑逻辑见 LineRowInner */
export function LineRow({ subId, line, index, characters, scenes }: {
  subId: string
  line: ScriptLine
  index: number
  characters: Character[]
  scenes: Scene[]
}) {
  const { editLine, removeLine, shiftLine, addLine, focusLineId, setFocusLine } = useEditorStore()

  return (
    <LineRowInner
      subId={subId}
      line={line}
      index={index}
      characters={characters}
      scenes={scenes}
      onEdit={(patch) => void editLine(subId, line.id, { kind: line.kind, ...patch } as LineIn)}
      onDelete={() => void removeLine(subId, line.id)}
      onMove={(delta) => void shiftLine(subId, line.id, delta)}
      onInsert={(data) => void addLine(subId, data)}
      onDuplicate={(data) => void addLine(subId, data)}
      shouldFocus={focusLineId === line.id}
      onFocusClaimed={() => setFocusLine(null)}
    />
  )
}
