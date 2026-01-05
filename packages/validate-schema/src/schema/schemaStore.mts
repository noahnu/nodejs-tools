import createDebug from 'debug'
import micromatch from 'micromatch'

import { lru } from '../utils/cache.mjs'

const debug = createDebug('SchemaStore')

interface JSONSchemaStoreCatalogSchema {
    name: string
    description: string
    fileMatch: string[]
    url: string
}
interface JSONSchemaStoreCatalog {
    $schema: string
    version: number
    schemas: JSONSchemaStoreCatalogSchema[]
}

const fetchSchemaStoreCatalog = lru(
    async function fetchSchemaStoreCatalog(): Promise<JSONSchemaStoreCatalog> {
        const SCHEMA_STORE_CATALOG_URL =
            'https://raw.githubusercontent.com/SchemaStore/schemastore/master/src/api/json/catalog.json'

        return (await (await fetch(SCHEMA_STORE_CATALOG_URL)).json()) as JSONSchemaStoreCatalog
    },
    { size: 1 },
)

export async function resolveSchemaFromSchemaStore({
    filename,
}: {
    filename: string
}): Promise<string | null> {
    const catalog = await fetchSchemaStoreCatalog()
    const match = catalog.schemas.find((schema) =>
        Boolean(
            schema.fileMatch?.length &&
            micromatch.isMatch(filename, schema.fileMatch, { basename: true }),
        ),
    )
    if (match) {
        debug(`[Schema Store] [${filename}]: Matched against '${match.name}'`)
        return match.url
    }
    return null
}
