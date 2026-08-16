import { Application, Container, Graphics, Text } from 'pixi.js'
import type { Beat, Project } from '@storyforge/shared'

/** 把工程按 chapterOrder 展平为 beat 序列（P0：忽略分支，线性播放） */
function flattenBeats(project: Project): Beat[] {
  const out: Beat[] = []
  for (const cid of project.chapterOrder) {
    const chapter = project.chapters.find((c) => c.id === cid)
    if (!chapter) continue
    for (const section of chapter.sections) {
      out.push(...section.beats)
    }
  }
  return out
}

/**
 * 最简 Galgame 播放器（P0 纵向切片）。
 * 只做高层 beat 直解释：对白 / 旁白 / 场景提示；点击或空格推进。
 * 立绘 / 表情 / BGM / 转场 / 粒子等演出特效在 P1/P2 增量。
 */
export class Player {
  private app: Application
  private beats: Beat[]
  private idx = -1
  private box: Container

  constructor(canvas: HTMLCanvasElement, project: Project) {
    this.app = new Application({
      view: canvas,
      width: project.resolution.width,
      height: project.resolution.height,
      backgroundColor: 0x16182a,
      antialias: true,
    })
    this.beats = flattenBeats(project)
    this.box = new Container()
    this.app.stage.addChild(this.box)

    canvas.addEventListener('pointerdown', () => this.advance())
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') this.advance()
    })

    this.advance()
  }

  private advance(): void {
    this.idx += 1
    if (this.idx >= this.beats.length) {
      this.showText('（完）', '')
      return
    }
    const beat = this.beats[this.idx]
    switch (beat.kind) {
      case 'dialogue':
        this.showText(beat.text, beat.characterId)
        break
      case 'narration':
        this.showText(beat.text, '')
        break
      case 'scene':
        this.showText(`【切换场景】${beat.sceneId}`, '')
        break
      case 'choice':
        this.showText(`【分支】${beat.options.map((o) => o.text).join(' / ')}`, '')
        break
      default:
        this.showText(`【${beat.kind}】`, '')
    }
  }

  private showText(text: string, name: string): void {
    this.box.removeChildren()
    const w = this.app.screen.width
    const h = this.app.screen.height

    const bg = new Graphics()
    bg.beginFill(0x000000, 0.65)
    bg.drawRoundedRect(80, h - 220, w - 160, 160, 12)
    bg.endFill()
    this.box.addChild(bg)

    const nameText = new Text(name, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: 28,
      fill: 0x5ea0ff,
      fontWeight: 'bold',
    })
    nameText.position.set(120, h - 200)
    this.box.addChild(nameText)

    const body = new Text(text, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: 34,
      fill: 0xffffff,
      wordWrap: true,
      wordWrapWidth: w - 240,
    })
    body.position.set(120, h - 155)
    this.box.addChild(body)
  }
}
