import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle the 3D libraries at startup. Without this, Vite re-bundles
  // React mid-session when a new drei import appears, and the page loads
  // two copies of React ("Invalid hook call").
  optimizeDeps: {
    include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
  },
})
