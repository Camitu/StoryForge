import { Player } from './player'
import { DEFAULT_PROJECT_ID, getProject } from './config'

function showError(msg: string): void {
  const el = document.getElementById('error')
  if (el) {
    el.textContent = msg
    el.hidden = false
  }
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement
  const projectId = new URLSearchParams(location.search).get('project') ?? DEFAULT_PROJECT_ID
  try {
    const project = await getProject(projectId)
    new Player(canvas, project)
  } catch (e) {
    showError(
      `无法加载工程「${projectId}」：${(e as Error).message}。` +
        `请确认 server 已运行（http://127.0.0.1:8790）。`,
    )
  }
}

void main()
