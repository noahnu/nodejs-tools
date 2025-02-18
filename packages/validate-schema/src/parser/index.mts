import path from 'node:path'

import JSON5 from 'json5'
import YAML from 'yaml'

export class ParseError extends Error {}

export async function parse<T>({
    filename,
    contents,
}: {
    filename: string
    contents: string
}): Promise<T> {
    const ext = path.extname(filename.replace(/#$/, ''))
    try {
        switch (ext) {
            case '.yaml':
            case '.yml':
                // Only supports single document YAMLs at the moment
                return YAML.parseDocument(contents).toJS()
            case '.json':
                return JSON.parse(contents)
            case '.jsonc':
            case '.json5':
                return JSON5.parse(contents)
            default:
                throw new Error(`No parser implemented for the '${ext}' file extension.`)
        }
    } catch (err) {
        throw new ParseError(String(err), { cause: err })
    }
}
