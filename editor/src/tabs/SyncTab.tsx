import { useEditorStore } from '../store'

/** LetsGal 同步 Tab */
export function SyncTab() {
  const { syncStatus, syncResult, syncing, bindLetsGal, runExport, runImport } = useEditorStore()
  const bound = syncStatus?.bound ?? false

  const onBind = async () => {
    const dir = window.prompt('请输入 LetsGal 工程目录（如 E:\\GamePro\\我的游戏）')
    if (dir) await bindLetsGal(dir)
  }

  const onExport = async () => {
    if (!window.confirm('确定将当前剧情同步到 LetsGal？会增量更新章节（保留 LetsGal 里的特效/动画）。')) return
    await runExport(false)
  }

  const onImport = async () => {
    if (!window.confirm('确定从 LetsGal 反向同步？LetsGal 中的特效/动画将被忽略（保留），新章节会导入为小章节。')) return
    await runImport(false)
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
          <button className="sync-btn" onClick={onBind} disabled={syncing}>
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
    </div>
  )
}
