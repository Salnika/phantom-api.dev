import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    host: true
  },
  build: {
    target: 'esnext',
    minify: 'esbuild'
  }
})