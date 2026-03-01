import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@crdts/crdt-core': path.resolve(__dirname, '../crdt-core/src/index.ts')
    }
  },
  server: {
    host: true
  }
})
