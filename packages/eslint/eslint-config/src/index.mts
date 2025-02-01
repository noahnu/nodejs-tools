import tseslint from 'typescript-eslint'

import baseConfig from './base/index.mjs'
import jestConfig from './jest/index.mjs'

const config = tseslint.config(...baseConfig, {
    files: ['**/*.test.{ts,tsx,js,jsx,cjs,mjs,mts,cts}'],
    extends: [...jestConfig],
})

export default config
