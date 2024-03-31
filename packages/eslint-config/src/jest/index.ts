import { type ESLint } from 'eslint'

const config: ESLint.ConfigData = {
    env: {
        jest: true,
    },
    plugins: ['jest'],
    extends: ['plugin:jest/recommended', 'plugin:jest/style'],
    rules: {},
}

export = config
