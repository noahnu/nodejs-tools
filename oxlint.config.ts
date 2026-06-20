import { defineConfig } from 'oxlint'

export default defineConfig({
  options: {
    typeAware: true,
  },
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vitest'],
  categories: {
    correctness: 'error',
  },
  ignorePatterns: [
    '**/.*',
    'packages/**/*.js',
    '**/lib',
    '**/coverage',
    '**/reports',
    '**/artifacts',
  ],
}) as ReturnType<typeof defineConfig>
