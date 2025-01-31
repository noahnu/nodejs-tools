import { Command, Option } from 'clipanion'
import * as t from 'typanion'

import { findUnusedFiles } from './api/index.mjs'

export class BaseCommand extends Command {
    entryFiles = Option.Array('--entry', {
        description:
            'Entry files into the codebase. These files are known to be ' +
            'used and any files that are dependencies of these entry files ' +
            'are also considered used files.',
        required: true,
    })

    ignorePatterns = Option.Array('--ignore', {
        description:
            'Glob patterns usued to exclude files. ' +
            'The patterns are applied during traversal ' +
            'of the directory tree.',
        required: false,
    })

    depth = Option.String('--depth', {
        description: 'Depth limit. Set to -1 to disable.',
        required: false,
        validator: t.isNumber(),
    })

    sourceDirectories = Option.Rest()

    async execute(): Promise<number | void> {
        const result = await findUnusedFiles({
            entryFiles: this.entryFiles,
            ignorePatterns: this.ignorePatterns,
            sourceDirectories: this.sourceDirectories.length
                ? this.sourceDirectories
                : [process.cwd()],
            depth:
                typeof this.depth === 'undefined'
                    ? -1
                    : parseInt(Math.max(this.depth, -1).toFixed(0), 10),
        })

        this.context.stdout.write(result.unused.join('\n'))
    }
}
