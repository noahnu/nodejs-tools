import { Command, Option } from 'clipanion'

export class BaseCommand extends Command {
    entryFiles = Option.Array('--entry', {
        description:
            'Entry files into the codebase. These files are known to be ' +
            'used and any files that are dependencies of these entry files ' +
            'are also considered used files.',
        required: true,
    })

    sourceDirectories = Option.Rest()

    async execute(): Promise<number | void> {
        this.context.stdout.write('Hello!')
    }
}
