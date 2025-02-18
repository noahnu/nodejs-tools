import fs from 'node:fs'
import path from 'node:path'

import createDebug from 'debug'

import { type ErrorObject, type SchemaObject, getAjvSingleton } from './ajv/index.mjs'
import { ParseError, parse } from './parser/index.mjs'
import { inferSchemaUrl } from './schema/inferSchemaUrl.mjs'
import { SchemaSource, SchemaStoreOption } from './schema/types.mjs'
import { lru } from './utils/cache.mjs'

const debug = createDebug('validate-schema')

export interface ValidationResult {
    schemaUrl?: string
    validationError?: ErrorObject[]
    validationWarning?: ErrorObject[]
    parseError?: Error
    compileError?: Error
}

const fetchSchemaFile = lru(
    async function fetchSchemaFile<T>({
        filename,
        url,
    }: {
        filename: string
        url: string
    }): Promise<T> {
        if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('//')) {
            // Download from remote to tmp dir
            return await parse({
                filename: url,
                contents: await (await fetch(url)).text(),
            })
        }

        // Return the file path relative to the filename
        const schemaFilename = path.resolve(path.dirname(filename), url)
        return await parse({
            filename: schemaFilename,
            contents: await fs.promises.readFile(schemaFilename, 'utf-8'),
        })
    },
    {
        size: 10,
    },
)

function isSupportedSchema(schema: unknown): boolean {
    if (
        schema &&
        typeof schema === 'object' &&
        '$schema' in schema &&
        typeof schema.$schema === 'string'
    ) {
        if (schema.$schema === 'http://json-schema.org/draft-04/schema#') {
            return false
        }
    }
    return true
}

export async function validateFile({
    filename,
    schemaStoreBehaviour,
}: {
    filename: string
    schemaStoreBehaviour?: SchemaStoreOption
}): Promise<ValidationResult> {
    const contents = await fs.promises.readFile(filename, 'utf-8')
    try {
        const data = await parse({ filename, contents })
        const { schemaUrl, schemaSource } = await inferSchemaUrl({
            filename,
            data,
            contents,
            schemaStoreBehaviour,
        })

        if (!schemaUrl) {
            debug(`[Validate File] [${filename}]: No schema found.`)
            return {} // no schema detected
        }

        debug(`[Validate File] [${filename}]: Schema found '${schemaUrl}' via ${schemaSource}`)

        const schema = await fetchSchemaFile({ filename, url: schemaUrl })

        if (!isSupportedSchema(schema)) {
            if (
                schemaSource === SchemaSource.SchemaStore &&
                schemaStoreBehaviour === SchemaStoreOption.Warn
            ) {
                return {} // ignore for now
            }
            return { parseError: new ParseError('The detected schema is not supported.') }
        }

        try {
            const validate = getAjvSingleton().compile(schema as SchemaObject)

            if (validate(data)) {
                return {} // valid
            }

            // If there's a validation failure but we're set to "warn"
            if (
                schemaSource === SchemaSource.SchemaStore &&
                schemaStoreBehaviour === SchemaStoreOption.Warn
            ) {
                return {
                    schemaUrl,
                    validationWarning: validate.errors ?? [],
                }
            }

            return {
                schemaUrl,
                validationError: validate.errors ?? [],
            }
        } catch (compileError) {
            // If there's a validation failure but we're set to "warn"
            if (
                schemaSource === SchemaSource.SchemaStore &&
                schemaStoreBehaviour === SchemaStoreOption.Warn
            ) {
                return {}
            }
            return {
                compileError:
                    compileError instanceof Error ? compileError : new Error(String(compileError)),
            }
        }
    } catch (err) {
        if (err instanceof ParseError) {
            return { parseError: err }
        }
        throw err
    }
}
