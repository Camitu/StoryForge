import { Player } from './player'
import { DEFAULT_PROJECT_ID, getProject } from './config'

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement
  const projectId = new URLSearchParams(location.search).get('project') ?? DEFAULT_PROJECT_ID
  const project = await getProject(projectId)
  new Player(canvas, project)
}

void main()
