import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test runner only. The real app build lives in vite.config.js.
// jsdom gives us window/localStorage/sessionStorage so the browser-oriented
// recruitment store runs unchanged, and the network layer is mocked per test
// so nothing ever reaches the live Firestore.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx,mjs}'],
    restoreMocks: true,
  },
})
