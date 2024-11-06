// @ts-check

// @ts-expect-error missing types
require('tsx/cjs')

const eslintConfig = require('@noahnu/eslint-config')

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const config = [
    ...eslintConfig,
    {
        languageOptions: {
            parserOptions: { project: './tsconfig.lint.json', tsconfigRootDir: __dirname },
        },
    },
    { ignores: ['**/coverage', '**/reports', '**/.*', 'packages/**/*.js', '**/lib'] },
]

module.exports = config
