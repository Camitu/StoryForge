import { useEffect, useRef, useState } from 'react'
import { getActiveDialog, getDialogSeq, subscribeDialog, closeDialog, type PromptOptions } from './dialog'

/** 全局对话框挂载点：confirm / prompt（替换 window.confirm / window.prompt） */
export function DialogHost() {
  const [, force] = useState(0)

  useEffect(() => subscribeDialog(() => force((n) => n + 1)), [])

  const dlg = getActiveDialog()
  if (!dlg) return null

  if (dlg.kind === 'confirm') {
    const o = dlg.options
    return (
      <div className="dlg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(false) }}>
        <div className="dlg-card" role="dialog" aria-modal="true">
          <h3 className="dlg-title">{o.title}</h3>
          {o.message && <div className="dlg-message">{o.message}</div>}
          <div className="dlg-actions">
            <button className="ghost-btn" onClick={() => closeDialog(false)}>{o.cancelText ?? '取消'}</button>
            <button className={`primary-btn ${o.danger ? 'dlg-danger' : ''}`} onClick={() => closeDialog(true)}>
              {o.okText ?? '确定'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <PromptBody key={getDialogSeq()} options={dlg.options} />
}

function PromptBody({ options }: { options: PromptOptions }) {
  const [value, setValue] = useState(options.initial ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => closeDialog(value)
  const cancel = () => closeDialog(null)

  return (
    <div className="dlg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel() }}>
      <div className="dlg-card" role="dialog" aria-modal="true">
        <h3 className="dlg-title">{options.title}</h3>
        {options.message && <div className="dlg-message">{options.message}</div>}
        <input
          ref={inputRef}
          className="input dlg-input"
          value={value}
          placeholder={options.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') cancel()
          }}
        />
        <div className="dlg-actions">
          <button className="ghost-btn" onClick={cancel}>{options.cancelText ?? '取消'}</button>
          <button className="primary-btn" onClick={submit}>{options.okText ?? '确定'}</button>
        </div>
      </div>
    </div>
  )
}
