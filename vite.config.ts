import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base so the build works under any GitHub Pages path (HashRouter handles routing).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
