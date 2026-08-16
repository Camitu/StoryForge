import { Application, Assets, Container, Graphics, Sprite, Text } from 'pixi.js'
import type { Beat, Character, Project, Scene } from '@storyforge/shared'
import { mediaUrl } from './config'

/** 按 chapterOrder 展平 beat 序列（P0：忽略分支，线性播放） */
function flattenBeats(project: Project): Beat[] {
  const out: Beat[] = []
  for (const cid of project.chapterOrder) {
    const chapter = project.chapters.find((c) => c.id === cid)
    if (!chapter) continue
    for (const section of chapter.sections) out.push(...section.beats)
  }
  return out
}

/** 背景：cover 铺满（保持比例，居中裁剪） */
function fitCover(sprite: Sprite, w: number, h: number): void {
  const scale = Math.max(w / sprite.texture.width, h / sprite.texture.height)
  sprite.scale.set(scale)
  sprite.x = (w - sprite.texture.width * scale) / 2
  sprite.y = (h - sprite.texture.height * scale) / 2
}

/** 立绘：撑满高度、底部对齐、水平居中 */
function fitCharacter(sprite: Sprite, w: number, h: number): void {
  const scale = h / sprite.texture.height
  sprite.scale.set(scale)
  sprite.x = (w - sprite.texture.width * scale) / 2
  sprite.y = 0
}

/**
 * Galgame 播放器（P0）：渲染真实背景 + 立绘 + 对白框。
 * 点击 / 空格 / 回车推进。转场 / 音效 / 多角色同屏等 P2 增量。
 */
export class Player {
  private app: Application
  private beats: Beat[]
  private idx = -1
  private stage: Container
  private ui: Container
  private bgSprite: Sprite | null = null
  private charSprite: Sprite | null = null
  private charById: Map<string, Character>
  private sceneById: Map<string, Scene>
  private busy = false

  constructor(canvas: HTMLCanvasElement, project: Project) {
    this.app = new Application({
      view: canvas,
      width: project.resolution.width,
      height: project.resolution.height,
      backgroundColor: 0x16182a,
      antialias: true,
    })
    this.beats = flattenBeats(project)
    this.charById = new Map(project.characters.map((c) => [c.id, c]))
    this.sceneById = new Map(project.scenes.map((s) => [s.id, s]))
    this.stage = new Container()
    this.ui = new Container()
    this.app.stage.addChild(this.stage, this.ui)

    canvas.addEventListener('pointerdown', () => void this.advance())
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') void this.advance()
    })

    void this.advance()
  }

  private async advance(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      this.idx += 1
      if (this.idx >= this.beats.length) {
        this.showText('（完）', '')
        return
      }
      const beat = this.beats[this.idx]
      switch (beat.kind) {
        case 'scene':
          await this.setScene(beat.sceneId)
          this.clearCharacter()
          this.hideText()
          break
        case 'dialogue': {
          const char = this.charById.get(beat.characterId)
          await this.setCharacter(char, beat.expression)
          this.showText(beat.text, char?.name ?? beat.characterId)
          break
        }
        case 'narration':
          this.showText(beat.text, '')
          break
        case 'choice':
          this.showText(`【分支】${beat.options.map((o) => o.text).join(' / ')}`, '')
          break
        default:
          this.showText(`【${beat.kind}】`, '')
      }
    } finally {
      this.busy = false
    }
  }

  private async loadTexture(assetPath: string) {
    try {
      return await Assets.load(mediaUrl(assetPath))
    } catch (e) {
      console.error('素材加载失败:', assetPath, e)
      return null
    }
  }

  private async setScene(sceneId: string): Promise<void> {
    const scene = this.sceneById.get(sceneId)
    const layer = scene?.layers[0]
    if (!layer) return
    const texture = await this.loadTexture(layer.assetPath)
    if (!texture) return
    if (this.bgSprite) this.stage.removeChild(this.bgSprite)
    const bg = new Sprite(texture)
    fitCover(bg, this.app.screen.width, this.app.screen.height)
    this.bgSprite = bg
    this.stage.addChild(bg)
  }

  private async setCharacter(char: Character | undefined, expression: string): Promise<void> {
    if (!char) return
    const exp = char.expressions.find((e) => e.name === expression) ?? char.expressions[0]
    if (!exp) return
    const texture = await this.loadTexture(exp.assetPath)
    if (!texture) return
    if (this.charSprite) this.stage.removeChild(this.charSprite)
    const sprite = new Sprite(texture)
    fitCharacter(sprite, this.app.screen.width, this.app.screen.height)
    this.charSprite = sprite
    this.stage.addChild(sprite)
  }

  private clearCharacter(): void {
    if (this.charSprite) {
      this.stage.removeChild(this.charSprite)
      this.charSprite = null
    }
  }

  private hideText(): void {
    this.ui.removeChildren()
  }

  private showText(text: string, name: string): void {
    this.ui.removeChildren()
    const w = this.app.screen.width
    const h = this.app.screen.height

    const bg = new Graphics()
    bg.beginFill(0x000000, 0.65)
    bg.drawRoundedRect(80, h - 220, w - 160, 160, 12)
    bg.endFill()
    this.ui.addChild(bg)

    const nameText = new Text(name, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: 28,
      fill: 0x5ea0ff,
      fontWeight: 'bold',
    })
    nameText.position.set(120, h - 200)
    this.ui.addChild(nameText)

    const body = new Text(text, {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: 34,
      fill: 0xffffff,
      wordWrap: true,
      wordWrapWidth: w - 240,
    })
    body.position.set(120, h - 155)
    this.ui.addChild(body)
  }
}
