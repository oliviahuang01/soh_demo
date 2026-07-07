import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  assetsInclude: ['**/*.csv'],
  base: '/soh_demo/',
})
