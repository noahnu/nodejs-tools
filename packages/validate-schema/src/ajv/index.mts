import Ajv, { type AnySchema, type ErrorObject, type SchemaObject } from 'ajv'

export type { ErrorObject, SchemaObject }

interface ValidateFunction<T = unknown> {
  (data: unknown): data is T
  errors?: ErrorObject[] | null
}

interface AjvInstance {
  removeKeyword(name: string): AjvInstance
  addKeyword(name: string): AjvInstance
  errorsText(errors?: ErrorObject[] | null): string
  readonly schemas: Record<string, unknown>
  addSchema(schema: AnySchema, key?: string): AjvInstance
  compile<T = unknown>(schema: SchemaObject): ValidateFunction<T>
}

function createAjvInstance(): AjvInstance {
  const instance = new Ajv.default({
    allowUnionTypes: true,
    strictTuples: false,
    validateSchema: false,
    strictSchema: false,
    strict: false,
    logger: false,
  })

  return instance.removeKeyword('id').addKeyword('id') as AjvInstance
}

let ajv: AjvInstance | null = null

export function getAjvSingleton(): AjvInstance {
  if (!ajv) {
    ajv = createAjvInstance()
  }

  return ajv
}

export function formatValidationErrors({
  errors,
}: {
  errors: ErrorObject[] | null | undefined
}): string {
  return getAjvSingleton().errorsText(errors)
}
