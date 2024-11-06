import { Cli } from 'clipanion'

import { BaseCommand } from './command'

const cli = new Cli({
    binaryLabel: '@noahnu/unused-files',
    binaryName: 'yarn @noahnu/unused-files',

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    binaryVersion: require('../package.json').version,
    enableCapture: true,
})

cli.register(BaseCommand)

cli.runExit(process.argv.slice(2))
