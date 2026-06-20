import { defineConfig } from 'oxfmt'

export default defineConfig({
  singleQuote: true,
  semi: false,
  sortPackageJson: false,
  ignorePatterns: ['**/coverage', '**/reports', '**/.*', 'packages/**/*.js', '**/lib'],
})
