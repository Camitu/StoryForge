import { useEffect, useRef } from 'react'

/**
 * 防抖自动保存 + 卸载时 flush：
 * - value 变化后 delay 毫秒无操作 → 自动触发 save
 * - 组件卸载（切换章节/片段）时若有未保存修改 → 立即保存，内容不丢
 * - 返回 valueRef：始终指向最新值，供即时保存逻辑读取
 */
export function useAutoSave<T>(value: T, initial: T, save: () => void, delay = 3000): React.MutableRefObject<T> {
  const valueRef = useRef(value)
  const initialRef = useRef(initial)
  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    valueRef.current = value
  }, [value])

  // 防抖自动保存
  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify(valueRef.current) !== JSON.stringify(initialRef.current)) {
        saveRef.current()
      }
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay])

  // 卸载时 flush 未保存修改
  const flushedRef = useRef(false)
  useEffect(() => () => {
    if (flushedRef.current) return
    flushedRef.current = true
    if (JSON.stringify(valueRef.current) !== JSON.stringify(initialRef.current)) {
      saveRef.current()
    }
  }, [])

  return valueRef
}
