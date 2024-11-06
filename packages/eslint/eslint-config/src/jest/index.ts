import eslintPluginJest from 'eslint-plugin-jest'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const config = tseslint.config(
    {
        languageOptions: {
            globals: { ...globals.jest },
        },
    },
    eslintPluginJest.configs['flat/recommended'],
)

export = config
