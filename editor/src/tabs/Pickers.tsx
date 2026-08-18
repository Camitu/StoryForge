import { useEffect, useRef, useState } from 'react'
import type { Character, Scene } from '@storyforge/shared'
import { createCharacter, createScene } from '../api'
import { useEditorStore } from '../store'

interface PickerItem {
  id: string
  name: string
}

interface NamePickerProps {
  items: PickerItem[]
  /** 当前已提交的名称（外部值变化时同步显示） */
  valueName: string
  /** datalist id，每行唯一 */
  listId: string
  placeholder: string
  /** 输入新名称时显示的小标签 */
  newHint: string
  className?: string
  onCommit: (id: string, name: string) => void
  onCreate: (name: string) => Promise<PickerItem>
}

/**
 * 名称选择器：既可下拉选择已有项，也可直接输入新名称。
 * - 回车（Enter）：不存在则新建
 * - 失焦：命中已有项 → 选中；是某已有名称的前缀（疑似输入一半）→ 回退，不新建；否则 → 新建
 */
function NamePicker({ items, valueName, listId, placeholder, newHint, className, onCommit, onCreate }: NamePickerProps) {
  const [text, setText] = useState(valueName)
  const committedRef = useRef<{ id: string; name: string }>({ id: '', name: valueName })
  const creatingRef = useRef(false)

  useEffect(() => {
    setText(valueName)
  }, [valueName])

  const trimmed = text.trim()
  const exist = items.find((i) => i.name === trimmed)
  const isPrefixOfExisting = trimmed !== '' && !exist && items.some((i) => i.name.startsWith(trimmed))

  const commit = async (force: boolean) => {
    const name = text.trim()
    if (!name) return
    const hit = items.find((i) => i.name === name)
    if (hit) {
      committedRef.current = { id: hit.id, name: hit.name }
      onCommit(hit.id, hit.name)
      return
    }
    // 失焦且疑似输入一半（如 IME 只打了前缀）→ 回退，不误建
    if (!force && isPrefixOfExisting) {
      setText(committedRef.current.name)
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    try {
      const created = await onCreate(name)
      committedRef.current = { id: created.id, name: created.name }
      setText(created.name)
      onCommit(created.id, created.name)
    } catch (e) {
      useEditorStore.setState({ error: (e as Error).message })
    } finally {
      creatingRef.current = false
    }
  }

  return (
    <span className={`picker-wrap ${className ?? ''}`}>
      <input
        className="line-picker"
        list={listId}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit(true)
          }
        }}
        onBlur={() => void commit(false)}
      />
      <datalist id={listId}>
        {items.map((i) => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>
      {trimmed !== '' && !exist && (
        <span className="picker-new-hint">{newHint}</span>
      )}
    </span>
  )
}

/** 角色选择器：选择已有角色 / 输入新角色名自动新建 */
export function CharacterPicker({ items, valueName, listId, onCommit }: {
  items: Character[]
  valueName: string
  listId: string
  onCommit: (id: string, name: string) => void
}) {
  const pid = useEditorStore((s) => s.currentProjectId)
  return (
    <NamePicker
      items={items}
      valueName={valueName}
      listId={listId}
      placeholder="选择/输入角色"
      newHint="新角色"
      className="picker-char"
      onCommit={onCommit}
      onCreate={async (name) => {
        const created = await createCharacter(pid!, { name })
        void useEditorStore.getState().loadCharacters()
        return created
      }}
    />
  )
}

/** 场景选择器：选择已有场景 / 输入新场景名自动新建 */
export function ScenePicker({ items, valueName, listId, onCommit }: {
  items: Scene[]
  valueName: string
  listId: string
  onCommit: (id: string, name: string) => void
}) {
  const pid = useEditorStore((s) => s.currentProjectId)
  return (
    <NamePicker
      items={items}
      valueName={valueName}
      listId={listId}
      placeholder="选择/输入场景"
      newHint="新场景"
      className="picker-scene"
      onCommit={onCommit}
      onCreate={async (name) => {
        const created = await createScene(pid!, name)
        void useEditorStore.getState().loadScenes()
        return created
      }}
    />
  )
}
