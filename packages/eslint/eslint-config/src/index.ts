import tseslint from 'typescript-eslint'

import baseConfig from './base'
import jestConfig from './jest'

const config = tseslint.config(...baseConfig, {
    files: ['**/*.test.{ts,tsx,js,jsx,cjs,mjs,mts,cts}'],
    extends: [...jestConfig],
})

export = config
