import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    // Health-check tests deliberately exercise a 2s database timeout.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    include: ['tests/**/*.test.js'],
  },
})
