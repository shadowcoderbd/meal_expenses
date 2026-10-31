import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PWA icons in public/ from public/logo.svg: `npm run icons`
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0f766e' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0f766e' } },
  },
  images: ['public/logo.svg'],
})
