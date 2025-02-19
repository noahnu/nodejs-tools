import Ajv, { type ErrorObject, type SchemaObject } from 'ajv'

export type { ErrorObject, SchemaObject }

let ajv: Ajv.Ajv | null = null

export function getAjvSingleton(): Ajv.Ajv {
    if (!ajv) {
        ajv = new Ajv.default({
            allowUnionTypes: true,
            strictTuples: false,
            validateSchema: false,
            strictSchema: false,
            strict: false,
            logger: false,
        })
    }

    // 'id' is not understood
    ajv.removeKeyword('id').addKeyword('id')

    return ajv
}

export function formatValidationErrors({
    errors,
}: {
    errors: ErrorObject[] | null | undefined
}): string {
    return getAjvSingleton().errorsText(errors)
}
