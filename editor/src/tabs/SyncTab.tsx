import { useState } from 'react'
import { useEditorStore } from '../store'
import { confirmDialog } from '../ui/dialog'
import { FolderPicker } from '../ui/FolderPicker'

/** LetsGal 同步 Tab */
export function SyncTab() {
  const { syncStatus, syncResult, syncing, bindLetsGal, runExport, runImport } = useEditorStore()
  const bound = syncStatus?.bound ?? false
  const [showBind, setShowBind] = useState(false)
  const [dirInput, setDirInput] = useState('')
  const [picking, setPicking] = useState(false)

  const onBind = async () => {
    const dir = dirInput.trim()
    if (!dir) return
    await bindLetsGal(dir)
    setShowBind(false)
    setDirInput('')
  }

  const onExport = async () => {
    const ok = await confirmDialog({
      title: '一键同步到 LetsGal？',
      message: '将当前剧情增量同步到 LetsGal（保留 LetsGal 里的特效/动画，原位不变）。',
      okText: '开始同步',
    })
    if (ok) await runExport(false)
  }

  const onImport = async () => {
    const ok = await confirmDialog({
      title: '反向同步（LetsGal → StoryForge）？',
      message: 'LetsGal 中的特效/动画将被忽略（保留在 LetsGal），新章节/新片段会导入为小章节/子片段。',
      okText: '开始同步',
    })
    if (ok) await runImport(false)
  }

  return (
    <div className="sync-tab">
      <h2>LetsGal 同步</h2>

      <div className="sync-status-card">
        <p className="sync-dir">{bound ? `📁 ${syncStatus?.letsgalDir}` : '未绑定 LetsGal 工程'}</p>
        {bound && (
          <p className="sync-meta">
            章节 {syncStatus?.chapters ?? '-'} · 角色 {syncStatus?.characters ?? '-'} · 场景 {syncStatus?.scenes ?? '-'}
            {syncStatus?.chapterNames && <span className="sync-chapters"> · {syncStatus.chapterNames.join(' / ')}</span>}
          </p>
        )}
        <div className="sync-actions">
          {!showBind ? (
            <>
              <button className="sync-btn" onClick={() => setShowBind(true)} disabled={syncing}>
                {bound ? '重新绑定目录' : '绑定 LetsGal 目录'}
              </button>
              {bound && (
                <>
                  <button className="sync-btn primary" onClick={onExport} disabled={syncing}>
                    {syncing ? '同步中…' : '一键同步 → LetsGal'}
                  </button>
                  <button className="sync-btn reverse" onClick={onImport} disabled={syncing}>
                    反向同步 ← LetsGal
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="bind-form">
              <input
                className="input bind-input"
                placeholder="LetsGal 工程目录，如 E:\GamePro\我的游戏"
                value={dirInput}
                onChange={(e) => setDirInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void onBind()}
                autoFocus
              />
              <button className="sync-btn" onClick={() => setPicking(true)} title="全屏浏览并选择文件夹">
                📁 选择文件夹
              </button>
              <button className="sync-btn primary" onClick={() => void onBind()} disabled={!dirInput.trim() || syncing}>
                确认绑定
              </button>
              <button className="sync-btn" onClick={() => { setShowBind(false); setDirInput('') }}>
                取消
              </button>
            </div>
          )}
        </div>
      </div>

      {syncResult && (
        <div className="sync-result-panel">
          <h3>最近同步结果（{syncResult.dry_run ? '预览' : '已执行'}）</h3>
          {syncResult.stats && (
            <p className="sync-result-stats">
              更新 {syncResult.stats.updated} · 新增 {syncResult.stats.added} · 保留特效 {syncResult.stats.skipped_effect_blocks ?? 0}
            </p>
          )}
          {syncResult.chapters?.map((c) => (
            <p key={c.file} className="sync-result-line">
              {c.file}：{c.blocks} blocks（更新 {c.updated} / 新增 {c.added}）
            </p>
          ))}
          {(syncResult.pendingCharacters?.length ?? 0) > 0 && (
            <p className="sync-result-line">新增占位角色：{syncResult.pendingCharacters?.map((c) => c.name).join('、')}</p>
          )}
          {(syncResult.pendingScenes?.length ?? 0) > 0 && (
            <p className="sync-result-line">新增占位场景：{syncResult.pendingScenes?.map((s) => s.name).join('、')}</p>
          )}
        </div>
      )}

      <div className="sync-help">
        <h3>使用说明</h3>
        <ul>
          <li>1. 在 LetsGal 中新建空项目</li>
          <li>2. 在此绑定该项目的目录</li>
          <li>3. 在 StoryForge 写完剧情 → 一键同步 → 到 LetsGal 实时预览</li>
          <li>4. 在 LetsGal 调特效/微调文本 → 反向同步 → 改动回到 StoryForge</li>
          <li>5. 特效/动画/音效等演出内容只在 LetsGal 中保留，反向同步不会丢失</li>
        </ul>
      </div>

      {picking && (
        <FolderPicker
          onSelect={(dir) => { setDirInput(dir); setPicking(false) }}
          onCancel={() => setPicking(false)}
        />
      )}
    </div>
  )
}
