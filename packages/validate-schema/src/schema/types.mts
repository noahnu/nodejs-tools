export enum SchemaSource {
    Directive = 'Language Server Directive',
    SchemaStore = 'JSON Schema Store',
    SchemaProperty = '$schema property',
}

export enum SchemaStoreOption {
    /** Warn but do not fail on validation failures from the schema store. */
    Warn = 'warn',

    /** Raise an error on validation failures derived from the schema store. */
    Error = 'error',
}
