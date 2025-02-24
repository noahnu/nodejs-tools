import fs from 'node:fs'
import path from 'node:path'

import { type AnySchema } from 'ajv'
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

async function fetchByUrl(url: string): Promise<string> {
    const headers: Record<string, string> = {}
    if (url.match(/(https:)?\/\/raw\.githubusercontent.com\//) && process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    const response = await fetch(url, {
        headers,
    })
    if (!response.ok) {
        throw new Error(`Failed to download schema '${url}': ${await response.text()}`)
    }
    return await response.text()
}

const fetchSchemaFile = lru(
    async function fetchSchemaFile<T>({
        filename,
        url,
    }: {
        filename: string
        url: string
    }): Promise<T> {
        if (url.match(/^(https?:)\/\//)) {
            // Download from remote to tmp dir
            return await parse({
                filename: url,
                contents: await fetchByUrl(url),
            })
        }

        if (filename.match(/^(https?:)\/\//)) {
            url = new URL(url, filename).toString()
            return await parse({
                filename: url,
                contents: await fetchByUrl(url),
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

function* iterateOverRefs(obj: object): Generator<string> {
    for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref') {
            yield value
        }
        if (typeof value === 'object') {
            yield* iterateOverRefs(value)
        }
    }
}

async function* getReferencedSchemas({
    schema,
    filename,
}: {
    schema: AnySchema
    filename: string
}) {
    const seen = new Set<string>()

    const queue: { schema: AnySchema; filename: string }[] = [{ schema, filename }]
    while (queue.length) {
        const current = queue.pop()
        if (!current?.schema || typeof current.schema !== 'object') continue
        if (seen.has(current.filename)) continue

        seen.add(current.filename)

        for (const $ref of iterateOverRefs(current.schema)) {
            if (seen.has($ref)) continue // already processed

            const refSchema = await fetchSchemaFile<AnySchema>({
                filename: current.filename,
                url: $ref,
            })
            queue.push({ schema: refSchema, filename: $ref })
            yield { $ref, refSchema }
        }
    }
}

export async function validateFile({
    filename,
    schemaStoreBehaviour,
}: {
    filename: string
    schemaStoreBehaviour?: SchemaStoreOption
}): Promise<ValidationResult> {
    const ajv = getAjvSingleton()
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

        const schema = await fetchSchemaFile<AnySchema>({ filename, url: schemaUrl })

        if (!isSupportedSchema(schema)) {
            if (
                schemaSource === SchemaSource.SchemaStore &&
                schemaStoreBehaviour === SchemaStoreOption.Warn
            ) {
                return {} // ignore for now
            }
            return { parseError: new ParseError('The detected schema is not supported.') }
        }

        // Add any referenced schemas
        for await (const { $ref, refSchema } of getReferencedSchemas({
            schema,
            filename: schemaUrl,
        })) {
            if (!($ref in ajv.schemas)) {
                debug(`[Validate File] [${filename}]: Adding schema $ref '${$ref}'`)
                ajv.addSchema(refSchema, $ref)
            }
        }

        try {
            const validate = ajv.compile(schema as SchemaObject)

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
                debug(`[Validate File] [${filename}]`, compileError)
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
