import path from 'node:path'

import { Command, Option, type Usage } from 'clipanion'
import createDebug from 'debug'
import fg from 'fast-glob'
import * as t from 'typanion'

import { formatValidationErrors } from './ajv/index.mjs'
import { SchemaStoreOption } from './schema/types.mjs'
import { type ValidationResult, validateFile } from './validate.mjs'

const DEFAULT_FILE_EXT = ['yml', 'yaml', 'json', 'json5', 'jsonc']

const debug = createDebug('validate-schema')

type Results = Partial<Record<string, ValidationResult>>

interface Summary {
    files: number
    parseError: number
    validationError: number
    validationWarning: number
}

enum OutputFormat {
    Text = 'text',
    GitHub = 'github',
}

class ValidateSchemaCommand extends Command {
    static paths = []

    static usage: Usage = Command.Usage({
        description:
            'Returns an exit code of 1 on validation failure and exit code of 2 on parse error.',
        details: '',
        examples: [],
    })

    cwd?: string = Option.String('--cwd', { required: false })

    exclude = Option.Array('--exclude', {
        description: 'Glob patterns usued to exclude files.',
        required: false,
    })

    format = Option.Array('--format', {
        description: 'Output format (github/text)',
        validator: t.isArray(t.isEnum(OutputFormat)),
    })

    schemaStoreBehaviour = Option.String('--schema-store', {
        description:
            'Whether to fallback to the public JSON schema store. ' +
            'Set this to warn or error depending on desired behaviour when we fallback to the schema store.',
        validator: t.isEnum(SchemaStoreOption),
        required: false,
    })

    patterns = Option.Rest()

    async execute(): Promise<number> {
        const cwd = this.cwd ?? process.cwd()
        process.chdir(cwd)

        const patterns = this.patterns.length ? this.patterns : [cwd]
        const ignore = ['**/node_modules', ...(this.exclude ?? [])]
        const formats = new Set<OutputFormat>(
            this.format?.length
                ? this.format
                : [
                      OutputFormat.Text,
                      ...(process.env.CI && process.env.GITHUB_ACTIONS
                          ? [OutputFormat.GitHub]
                          : []),
                  ],
        )

        const results: Results = {}
        const summary: Summary = {
            files: 0,
            parseError: 0,
            validationError: 0,
            validationWarning: 0,
        }

        for await (const filename of this.iterateFilePatterns({ patterns, ignore, cwd })) {
            debug(`[Processing] [${filename}]`)
            summary.files++

            const result = (results[filename] = await validateFile({
                filename,
                schemaStoreBehaviour: this.schemaStoreBehaviour,
            }))
            if (result.parseError) {
                debug(`[Parse Error] [${filename}]`, result.parseError)
                summary.parseError++
            } else if (result.validationError) {
                summary.validationError++
                const message = formatValidationErrors({ errors: result.validationError })
                if (formats.has(OutputFormat.Text)) {
                    this.context.stderr.write(`[Validation Error] [${filename}] ${message}\n`)
                }
                if (formats.has(OutputFormat.GitHub)) {
                    this.context.stderr.write(
                        `::error file=${path.relative(cwd, filename)},title=Schema Validation Failure::${message}\n`,
                    )
                }
            } else if (result.validationWarning) {
                summary.validationWarning++
                const message = formatValidationErrors({ errors: result.validationWarning })
                if (formats.has(OutputFormat.Text)) {
                    this.context.stderr.write(`[Validation Warning] [${filename}] ${message}\n`)
                }
                if (formats.has(OutputFormat.GitHub)) {
                    this.context.stderr.write(
                        `::warning file=${path.relative(cwd, filename)},title=Schema Validation Failure::${message}\n`,
                    )
                }
            }
        }

        // Print summary
        this.context.stdout.write(
            `Schema Validation: ${summary.files} file${summary.files === 1 ? '' : 's'} processed. ` +
                `${summary.parseError} parse error${summary.parseError === 1 ? '' : 's'}, ` +
                `${summary.validationError} validation error${summary.validationError === 1 ? '' : 's'}, ` +
                `and ${summary.validationWarning} validation warning${summary.validationWarning === 1 ? '' : 's'}.\n`,
        )

        if (Object.values(results).some((r) => r?.compileError)) {
            return 3
        }
        if (Object.values(results).some((r) => r?.parseError)) {
            return 2
        }
        if (Object.values(results).some((r) => r?.validationError?.length)) {
            return 1
        }
        return 0
    }

    private async *iterateFilePatterns({
        patterns,
        cwd,
        ignore,
    }: {
        patterns: string[]
        ignore: string[]
        cwd: string
    }) {
        const seen = new Set<string>()

        for (const pattern of patterns) {
            let globPattern = pattern
            if (!fg.isDynamicPattern(pattern)) {
                if (path.extname(pattern)) {
                    globPattern = pattern
                } else {
                    globPattern = path.join(pattern, `**/*.{${DEFAULT_FILE_EXT.join(',')}}`)
                }
            }

            for await (const file of await fg.globStream(globPattern, {
                dot: false,
                ignore,
                absolute: true,
                cwd,
            })) {
                const filename = String(file)

                if (!seen.has(filename)) {
                    seen.add(filename)
                    yield String(filename)
                }
            }
        }
    }
}

export { ValidateSchemaCommand }
