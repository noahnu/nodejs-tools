import { defineConfig } from 'vitest/config'

const CI = Boolean(process.env.CI)

export default defineConfig({
  test: {
    include: ['packages/**/*.test.{cts,mts,ts}'],
    testTimeout: 30_000,
    environment: 'node',
    reporters: CI ? ['default', 'junit'] : ['default'],
    outputFile: CI ? { junit: 'reports/vitest/vitest.junit.xml' } : undefined,
    coverage: {
      enabled: CI,
      provider: 'v8',
      reportsDirectory: 'raw-coverage/vitest',
      reporter: CI ? ['json'] : ['text', 'json'],
      include: ['packages/**/src/**/*.{ts,mts}', '.yarn/__virtual__/**/packages/**/*.{cts,ts,mts}'],
      exclude: [
        '**/node_modules/**',
        '**/__mocks__/**',
        '**/*.test.{ts,mts}',
        '**/*.mock.{ts,mts}',
      ],
    },
    pool: CI ? 'forks' : undefined,
    fileParallelism: !CI,
  },
  server: {
    watch: {
      ignored: ['**/packages/**/lib/**', '**/*.mjs'],
    },
  },
})
