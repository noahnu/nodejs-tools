// @ts-check

// @ts-expect-error missing types
await import('tsx/esm')

const eslintConfig = await import('@noahnu/eslint-config')

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const config = [
    ...eslintConfig.default,
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.lint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    { ignores: ['**/coverage', '**/reports', '**/.*', 'packages/**/*.js', '**/lib'] },
]

export default config
