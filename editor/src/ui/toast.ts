/** 轻量全局 Toast（成功/错误/信息），由 ToastHost 挂载点渲染。 */

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

let toasts: ToastItem[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getToasts(): ToastItem[] {
  return toasts
}

export function subscribeToasts(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function toast(text: string, kind: ToastKind = 'info'): void {
  const id = ++seq
  toasts = [...toasts, { id, kind, text }]
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 2600)
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}
