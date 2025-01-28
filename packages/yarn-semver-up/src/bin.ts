import { Cli } from 'clipanion'

import { SemverUpCommand } from './command'

const cli = new Cli({
    binaryLabel: '@noahnu/yarn-semver-up',
    binaryName: 'yarn @noahnu/yarn-semver-up',

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    binaryVersion: require('../package.json').version,
    enableCapture: true,
})

cli.register(SemverUpCommand)

cli.runExit(process.argv.slice(2))
