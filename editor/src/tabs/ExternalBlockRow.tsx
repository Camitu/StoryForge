import type { ReactNode } from 'react'
import type { ExternalBlock } from '@storyforge/shared'

const TYPE_ICON: Record<string, string> = {
  branch: '🔀',
  particle: '✨',
  sound: '🔊',
  curtain: '🎭',
  floatingText: '💬',
  camera: '🎥',
  background: '🖼️',
  transition: '🌀',
  wait: '⏳',
}

/** 外部演出块只读占位行（来自 LetsGal 的特效/分支等，编辑仍在 LetsGal 进行） */
export function ExternalBlockRow({ block }: { block: ExternalBlock }) {
  return (
    <div className="ext-block-row" title={`来自 LetsGal 的 ${block.type} 块（StoryForge 只读占位，编辑请在 LetsGal 中进行）`}>
      <span className="ext-block-no">▸</span>
      <span className="ext-block-icon">{TYPE_ICON[block.type] ?? '🎬'}</span>
      <span className="ext-block-label">{block.label || block.type}</span>
      <span className="ext-block-type">{block.type}</span>
    </div>
  )
}

/** 按 afterLineIndex 把外部演出块插入行列表对应位置（保持剧情流顺序） */
export function withExternalBlocks<T>(
  lines: T[],
  externalBlocks: ExternalBlock[] | undefined,
  renderLine: (line: T, index: number) => ReactNode,
): ReactNode[] {
  const byPos: Record<number, ExternalBlock[]> = {}
  for (const e of externalBlocks ?? []) {
    ;(byPos[e.afterLineIndex] ??= []).push(e)
  }
  const rows: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    rows.push(renderLine(lines[i], i))
    for (const e of byPos[i + 1] ?? []) {
      rows.push(<ExternalBlockRow key={e.id} block={e} />)
    }
  }
  for (const e of byPos[lines.length] ?? []) {
    rows.push(<ExternalBlockRow key={e.id} block={e} />)
  }
  return rows
}
