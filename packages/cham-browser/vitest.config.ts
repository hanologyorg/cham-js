import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'template/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['template/__tests__/**/*.test.ts'],
  },
})
