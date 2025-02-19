import { resolveSchemaFromSchemaStore } from './schemaStore.mjs'
import { SchemaSource, type SchemaStoreOption } from './types.mjs'

const YAML_LANGUAGE_SERVER_DIRECTIVE = /^#\s*yaml-language-server:\s*\$schema\s*=\s*([^\s]+)\s*$/im

export async function inferSchemaUrl({
    data,
    contents,
    schemaStoreBehaviour,
    filename,
}: {
    filename: string
    data: unknown
    contents: string
    schemaStoreBehaviour?: SchemaStoreOption
}): Promise<{ schemaUrl: string | null; schemaSource: SchemaSource | null }> {
    if (data && typeof data === 'object' && '$schema' in data && data.$schema) {
        return { schemaUrl: String(data.$schema), schemaSource: SchemaSource.SchemaProperty }
    }

    // No explicit $schema attribute has been defined. Check if there's a directive
    const match = contents.match(YAML_LANGUAGE_SERVER_DIRECTIVE)
    if (match) {
        const url = match[1]
        if (url) return { schemaUrl: url, schemaSource: SchemaSource.Directive }
    }

    if (schemaStoreBehaviour) {
        const url = await resolveSchemaFromSchemaStore({ filename })
        if (url) return { schemaUrl: url, schemaSource: SchemaSource.SchemaStore }
    }

    // Unable to resolve schema
    return { schemaUrl: null, schemaSource: null }
}
