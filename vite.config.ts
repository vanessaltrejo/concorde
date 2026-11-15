import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const cesiumBuild = 'node_modules/cesium/Build/Cesium'

export default defineConfig({
  plugins: [
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
})
