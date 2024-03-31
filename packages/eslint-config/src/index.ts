import { type ESLint } from 'eslint'

const config: ESLint.ConfigData = {
    extends: ['@noahnu/eslint-config/base'],
    rules: {},
    overrides: [
        {
            files: ['**/*.test.*'],
            extends: ['@noahnu/eslint-config/jest'],
        },
    ],
}

export = config
