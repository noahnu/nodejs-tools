import { createRequire } from 'node:module'

import { Cli } from 'clipanion'

import { DependencyCheckerCommand } from './command.mjs'

const require = createRequire(import.meta.url)

const cli = new Cli({
    binaryLabel: '@noahnu/yarn-dependency-checker',
    binaryName: 'yarn @noahnu/yarn-dependency-checker',

    binaryVersion: require('../package.json').version,
    enableCapture: true,
})

cli.register(DependencyCheckerCommand)

cli.runExit(process.argv.slice(2))
