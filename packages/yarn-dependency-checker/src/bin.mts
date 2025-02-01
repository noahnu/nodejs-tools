import { Cli } from 'clipanion'

import { DependencyCheckerCommand } from './command.mjs'

const cli = new Cli({
    binaryLabel: '@noahnu/yarn-dependency-checker',
    binaryName: 'yarn @noahnu/yarn-dependency-checker',

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    binaryVersion: require('../package.json').version,
    enableCapture: true,
})

cli.register(DependencyCheckerCommand)

cli.runExit(process.argv.slice(2))
