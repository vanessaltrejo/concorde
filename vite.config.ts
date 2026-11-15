import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const cesiumBuild = 'node_modules/cesium/Build/Cesium'

// Server-only settings for api/chat: AI_* and *_API_KEY (never VITE_*: Vite
// would expose those to the browser).
const isServerEnv = (key: string) => key.startsWith('AI_') || key.endsWith('_API_KEY')

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// `npm run dev` serves POST /api/chat with the same handler Vercel runs, so
// no Vercel CLI is needed locally. The key is read from .env.local.
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        void (async () => {
          try {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end()
              return
            }
            const mod = (await server.ssrLoadModule('/api/chat.ts')) as { POST: (r: Request) => Promise<Response> }
            const headers = new Headers()
            for (const [key, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') headers.set(key, value)
            }
            const response = await mod.POST(
              new Request('http://localhost/api/chat', { method: 'POST', headers, body: new Uint8Array(await readBody(req)) }),
            )
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch (error) {
            server.config.logger.error(`[api/chat] ${error instanceof Error ? error.stack : String(error)}`)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ type: 'error', code: 'provider', message: 'The local API failed (see the dev server log).' }))
          }
        })()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) if (isServerEnv(key) && value && !process.env[key]) process.env[key] = value
  return {
    plugins: [
      apiDevServer(),
      react(),
      tailwindcss(),
      // CesiumJS loads its web workers and assets from a folder at runtime
      // (window.CESIUM_BASE_URL = '/cesium/', set in index.html).
      viteStaticCopy({
        targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((folder) => ({
          src: `${cesiumBuild}/${folder}`,
          dest: 'cesium',
          // Keep only the folder name (Workers, Assets...) under /cesium/.
          rename: { stripBase: 4 },
        })),
      }),
    ],
    // Pre-bundle the 3D libraries at startup. Without this, Vite re-bundles
    // React mid-session when a new import appears, and the page loads two
    // copies of React ("Invalid hook call"). Cesium is loaded lazily, so it is
    // listed here too.
    optimizeDeps: {
      include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', 'cesium'],
    },
  }
})
