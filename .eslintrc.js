module.exports = {
    root: true,
    extends: ['@noahnu/eslint-config'],
    parserOptions: {
        project: './tsconfig.lint.json',
    },
    ignorePatterns: ['**/.*', 'packages/**/*.js', '**/lib'],
}
