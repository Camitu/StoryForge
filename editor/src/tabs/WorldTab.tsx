import { useRef, useState } from 'react'
import type { Chapter, Scene } from '@storyforge/shared'
import { useEditorStore } from '../store'
import { mediaUrl, uploadImage } from '../api'
import { confirmDialog, promptDialog } from '../ui/dialog'
import { toast } from '../ui/toast'
import { ExpressionManager } from './ExpressionManager'

/** 人设世界观 Tab */
export function WorldTab() {
  const { project, characters, scenes, saveWorld, addCharacter, addScene } = useEditorStore()
  const [worldview, setWorldview] = useState(project?.worldview ?? '')
  const [editingWorld, setEditingWorld] = useState(false)
  const [worldSaved, setWorldSaved] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newSceneName, setNewSceneName] = useState('')

  const onSaveWorld = async () => {
    await saveWorld(worldview)
    setWorldSaved(true)
    setEditingWorld(false)
    setTimeout(() => setWorldSaved(false), 1500)
  }

  const onAddCharacter = async () => {
    const name = newCharName.trim()
    if (!name) return
    await addCharacter({ name, note: '', baseSetting: '' })
    setNewCharName('')
  }

  const onAddScene = async () => {
    const name = newSceneName.trim()
    if (!name) return
    await addScene(name)
    setNewSceneName('')
  }

  return (
    <div className="world-tab">
      {/* 整体世界观 */}
      <section className="worldview-section">
        <div className="section-head">
          <h2>整体世界观</h2>
          {!editingWorld ? (
            <button className="ghost-btn" onClick={() => setEditingWorld(true)}>修改</button>
          ) : (
            <div className="section-actions">
              <button className="primary-btn" onClick={onSaveWorld} disabled={worldSaved}>
                {worldSaved ? '已保存 ✓' : '保存'}
              </button>
              <button className="ghost-btn" onClick={() => { setWorldview(project?.worldview ?? ''); setEditingWorld(false) }}>取消</button>
            </div>
          )}
        </div>
        {editingWorld ? (
          <textarea
            className="textarea worldview-text"
            rows={5}
            value={worldview}
            placeholder="定义整个故事的世界观、时代背景、核心设定…"
            onChange={(e) => setWorldview(e.target.value)}
          />
        ) : (
          <div className="worldview-view">
            {project?.worldview?.trim() ? project.worldview : <span className="empty-hint">（未设置世界观）</span>}
          </div>
        )}
      </section>

      {/* 角色 */}
      <section className="characters-section">
        <div className="section-head">
          <h2>角色（{characters.length}）</h2>
          <div className="add-char-row">
            <input
              className="input"
              placeholder="新角色姓名"
              value={newCharName}
              onChange={(e) => setNewCharName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onAddCharacter()}
            />
            <button className="primary-btn" onClick={onAddCharacter} disabled={!newCharName.trim()}>
              ＋ 新建角色
            </button>
          </div>
        </div>
        <div className="char-grid">
          {characters.map((c) => (
            <CharacterCard key={c.id} cid={c.id} />
          ))}
        </div>
      </section>

      {/* 场景 */}
      <section className="scenes-section">
        <div className="section-head">
          <h2>场景（{scenes.length}）</h2>
          <div className="add-char-row">
            <input
              className="input"
              placeholder="新场景名称"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onAddScene()}
            />
            <button className="primary-btn" onClick={onAddScene} disabled={!newSceneName.trim()}>
              ＋ 新建场景
            </button>
          </div>
        </div>
        <div className="scene-grid">
          {scenes.map((s) => (
            <SceneCard key={s.id} scene={s} />
          ))}
          {scenes.length === 0 && (
            <div className="empty-hint">还没有场景。写作时在「切场景」行直接输入新场景名也会自动创建。</div>
          )}
        </div>
      </section>
    </div>
  )
}

/** 场景卡片：16:9 形象图（可上传）+ 场景名 + 重命名/删除 */
function SceneCard({ scene }: { scene: Scene }) {
  const { currentProjectId, chapters, saveScene, removeScene } = useEditorStore()
  const [imagePath, setImagePath] = useState(scene.imagePath ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pid = currentProjectId!

  const countRefs = (chapters: Chapter[], sid: string) => {
    let n = 0
    for (const ch of chapters) {
      for (const sub of ch.subChapters) {
        for (const line of sub.lines) {
          if ('sceneId' in line && line.sceneId === sid) n += 1
        }
        for (const frag of sub.fragments ?? []) {
          for (const line of frag.lines) {
            if ('sceneId' in line && line.sceneId === sid) n += 1
          }
        }
      }
    }
    return n
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pid) return
    try {
      const { path } = await uploadImage(pid, file)
      setImagePath(path)
      await saveScene(scene.id, scene.name, scene.note, path)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    e.target.value = ''
  }

  const onClearImage = async () => {
    setImagePath('')
    await saveScene(scene.id, scene.name, scene.note, '')
  }

  const onRename = async () => {
    const name = await promptDialog({ title: '重命名场景', placeholder: '场景名称', initial: scene.name })
    if (!name?.trim() || name.trim() === scene.name) return
    await saveScene(scene.id, name.trim(), scene.note, imagePath || undefined)
  }

  const onRemove = async () => {
    const refs = countRefs(chapters, scene.id)
    const warn = refs > 0 ? `该场景被 ${refs} 处剧情行引用，删除后这些行将失去场景名。` : ''
    const ok = await confirmDialog({
      title: `确定删除场景「${scene.name}」？`,
      message: warn || undefined,
      okText: '删除',
      danger: true,
    })
    if (ok) await removeScene(scene.id)
  }

  return (
    <div className="scene-card">
      <div
        className="scene-card-image"
        title="双击选择场景形象图（复制到工程目录）"
        onDoubleClick={() => fileInputRef.current?.click()}
      >
        {imagePath ? (
          <img src={mediaUrl(pid, imagePath)} alt={scene.name} />
        ) : (
          <span className="scene-card-placeholder">🏞 {scene.name}</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onPickImage(e)}
        />
      </div>
      <div className="scene-card-footer">
        <span className="scene-card-name" title="双击重命名" onDoubleClick={() => void onRename()}>
          {scene.name}
        </span>
        <span className="scene-card-actions">
          <button title="重命名" onClick={() => void onRename()}>✎</button>
          {imagePath && (
            <button title="清除图像" onClick={() => void onClearImage()}>🗑</button>
          )}
          <button title="删除" className="danger" onClick={() => void onRemove()}>✕</button>
        </span>
      </div>
    </div>
  )
}

function CharacterCard({ cid }: { cid: string }) {
  const { currentProjectId, characters, saveCharacter, removeCharacter } = useEditorStore()
  const c = characters.find((x) => x.id === cid)!
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(c.note ?? '')
  const [baseSetting, setBaseSetting] = useState(c.baseSetting ?? '')
  const [imagePath, setImagePath] = useState(c.imagePath ?? '')
  const [timeline, setTimeline] = useState(c.plotTimeline ?? [])
  const [saved, setSaved] = useState(false)
  const [showExprMgr, setShowExprMgr] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pid = currentProjectId!

  const beginEdit = () => {
    setNote(c.note ?? '')
    setBaseSetting(c.baseSetting ?? '')
    setImagePath(c.imagePath ?? '')
    setTimeline(c.plotTimeline ?? [])
    setEditing(true)
  }

  const onSave = async () => {
    await saveCharacter(cid, { name: c.name, note, baseSetting, imagePath, plotTimeline: timeline })
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 1500)
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pid) return
    try {
      const { path } = await uploadImage(pid, file)
      setImagePath(path)
      // 选图即保存（无需额外点保存）
      await saveCharacter(cid, { name: c.name, note, baseSetting, imagePath: path, plotTimeline: timeline })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    e.target.value = ''
  }

  const onClearImage = async () => {
    setImagePath('')
    await saveCharacter(cid, { name: c.name, note, baseSetting, imagePath: '', plotTimeline: timeline })
  }

  const onRemove = async () => {
    const ok = await confirmDialog({ title: `确定删除角色「${c.name}」？`, okText: '删除', danger: true })
    if (ok) await removeCharacter(cid)
  }

  return (
    <div className="char-card">
      {/* 形象区域：撑满卡片左右，不留内外边距；双击仅换图（不进入文本编辑） */}
      <div
        className="char-portrait"
        title="双击选择形象图片（复制到工程目录）"
        onDoubleClick={() => fileInputRef.current?.click()}
      >
        {imagePath ? (
          <img src={mediaUrl(pid, imagePath)} alt={c.name} />
        ) : (
          <span className="char-portrait-name">{c.name}</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onPickImage(e)}
        />
      </div>

      {/* 角色名 + 操作按钮同行：名靠左、按钮靠右 */}
      <div className="char-head">
        <h3 className="char-name">{c.name}</h3>
        <div className="char-card-actions">
          {!editing ? (
            <>
              <button className="ghost-btn small" onClick={beginEdit}>修改</button>
              <button className="ghost-btn small" onClick={() => setShowExprMgr(true)} title="查看/批量替换该角色已使用的表情差分">
                表情差分
              </button>
              {imagePath && (
                <button className="ghost-btn small" onClick={() => void onClearImage()} title="清除形象图像">
                  清除图像
                </button>
              )}
              <button className="danger-btn small" onClick={onRemove}>删除</button>
            </>
          ) : (
            <>
              <button className="ghost-btn small" onClick={onSave}>{saved ? '✓' : '保存'}</button>
              <button className="ghost-btn small" onClick={() => setEditing(false)}>取消</button>
            </>
          )}
        </div>
      </div>

      {/* 备注 */}
      <div className="char-field">
        <span className="char-field-label">备注</span>
        {editing ? (
          <input className="input" value={note} placeholder="男主角 / 女主角…" onChange={(e) => setNote(e.target.value)} />
        ) : (
          <p className="char-field-value">{note || '—'}</p>
        )}
      </div>

      {/* 基本设定 */}
      <div className="char-field">
        <span className="char-field-label">基本设定</span>
        {editing ? (
          <textarea
            className="textarea"
            rows={6}
            value={baseSetting}
            placeholder="- **年龄**：18 岁…&#10;- **性格**：成熟稳重…"
            onChange={(e) => setBaseSetting(e.target.value)}
          />
        ) : (
          <pre className="char-field-value pre">{baseSetting || '—'}</pre>
        )}
      </div>

      {/* 剧情设定（日期格式） */}
      <div className="char-field">
        <span className="char-field-label">剧情设定（随时间线变化）</span>
        {editing ? (
          <div className="timeline-points">
            {timeline.map((t, i) => (
              <div key={i} className="timeline-point-row">
                <input
                  type="date"
                  className="input date-input"
                  value={t.date}
                  onChange={(e) => {
                    const next = [...timeline]
                    next[i] = { ...t, date: e.target.value }
                    setTimeline(next)
                  }}
                />
                <input
                  className="input"
                  value={t.content}
                  placeholder="剧情设定内容"
                  onChange={(e) => {
                    const next = [...timeline]
                    next[i] = { ...t, content: e.target.value }
                    setTimeline(next)
                  }}
                />
                <button
                  className="ghost-btn small"
                  onClick={() => setTimeline(timeline.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="ghost-btn small" onClick={() => setTimeline([...timeline, { date: '', content: '' }])}>
              ＋ 剧情设定点
            </button>
          </div>
        ) : (
          <div className="timeline-points view">
            {timeline.length === 0 ? (
              <span className="char-field-value">—</span>
            ) : (
              timeline.map((t, i) => (
                <div key={i} className="timeline-point-row view">
                  <span className="timeline-point-date">{t.date || '--'}</span>
                  <span className="char-field-value">{t.content}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showExprMgr && (
        <ExpressionManager cid={cid} charName={c.name} onClose={() => setShowExprMgr(false)} />
      )}
    </div>
  )
}
