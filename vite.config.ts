import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// Dev-only sink for bakeCrowdLayers(): writes the posted bytes into the baked-layer folder.
function crowdBake(): Plugin {
  const folder = new URL('./src/assets/binary-character/baked/', import.meta.url)
  return {
    name: 'crowd-bake',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__bake/', (req, res) => {
        const name = (req.url ?? '').replace(/^\//, '')
        if (req.method !== 'POST' || !/^[A-Za-z0-9._-]+$/.test(name)) { res.statusCode = 400; res.end(); return }
        const chunks: Buffer[] = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
          mkdirSync(folder, { recursive: true })
          writeFileSync(new URL(name, folder), Buffer.concat(chunks))
          res.end('ok')
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crowdBake()],
})
