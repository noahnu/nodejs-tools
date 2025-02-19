import { createRequire } from 'node:module'

import { Cli } from 'clipanion'

import { ValidateSchemaCommand } from './command.mjs'

const require = createRequire(import.meta.url)

const cli = new Cli({
    binaryLabel: '@noahnu/validate-schema',
    binaryName: 'yarn @noahnu/validate-schema',

    binaryVersion: require('../package.json').version,
    enableCapture: true,
})

cli.register(ValidateSchemaCommand)

cli.runExit(process.argv.slice(2))
