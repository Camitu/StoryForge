import { Player } from './player'
import sampleJson from '../../shared/examples/sample-project.json'
import type { Project } from '@storyforge/shared'

const canvas = document.getElementById('game') as HTMLCanvasElement
new Player(canvas, sampleJson as unknown as Project)
