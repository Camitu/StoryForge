/** 应用内对话框（确认 / 输入），替换 window.confirm / window.prompt。
 *  用法：
 *    const ok = await confirmDialog({ title: '删除？', message: '…', danger: true })
 *    const name = await promptDialog({ title: '新章节名', placeholder: '新章节' })
 *  由 DialogHost 挂载点渲染；取消/关闭时 resolve null / false。
 */

export interface ConfirmOptions {
  title: string
  message?: string
  okText?: string
  cancelText?: string
  /** 危险操作（删除等）：确认按钮用红色 */
  danger?: boolean
}

export interface PromptOptions {
  title: string
  message?: string
  placeholder?: string
  initial?: string
  okText?: string
  cancelText?: string
}

export type ActiveDialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void }

let active: ActiveDialog | null = null
let seq = 0
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

export function getActiveDialog(): ActiveDialog | null {
  return active
}

/** 每次打开对话框递增，用于给 Prompt 组件换 key 重置内部输入状态 */
export function getDialogSeq(): number {
  return seq
}

export function subscribeDialog(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    active = { kind: 'confirm', options, resolve }
    seq += 1
    emit()
  })
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    active = { kind: 'prompt', options, resolve }
    seq += 1
    emit()
  })
}

export function closeDialog(value: boolean | string | null): void {
  const d = active
  if (!d) return
  active = null
  emit()
  if (d.kind === 'confirm') {
    d.resolve(value === true)
  } else {
    d.resolve(typeof value === 'string' ? value : null)
  }
}
