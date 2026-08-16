import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@storyforge/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
})
