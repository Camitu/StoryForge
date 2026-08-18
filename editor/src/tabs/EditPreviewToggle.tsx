import { useEditorStore } from '../store'

/** 编辑 / 预览 切换（保存按钮前），预览模式隐藏输入框：标准=只读行，自由=Markdown */
export function EditPreviewToggle() {
  const preview = useEditorStore((s) => s.preview)
  const setPreview = useEditorStore((s) => s.setPreview)
  return (
    <div className="mode-group">
      <button className={`mode-btn ${!preview ? 'active' : ''}`} onClick={() => setPreview(false)} title="编辑模式">编辑</button>
      <button className={`mode-btn ${preview ? 'active' : ''}`} onClick={() => setPreview(true)} title="预览模式">预览</button>
    </div>
  )
}
