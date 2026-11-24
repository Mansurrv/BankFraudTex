import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {proxy: {'/api': {target: process.env.ORBIT_API_URL || 'http://127.0.0.1:8081'}}},
  build: {chunkSizeWarningLimit: 750, rollupOptions: {output: {manualChunks: {
    three: ['three'], graph: ['@react-three/fiber','@react-three/drei'], charts: ['recharts']
  }}}}
})
