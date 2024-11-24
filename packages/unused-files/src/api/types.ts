export interface ResolverResult {
    /** Resolved path. */
    result: string
}

export interface ResolverParams {
    /** The module/path being requested. */
    request: string

    /** The file or directory to resolve the request from. */
    context: string
}

/**
 * Used to resolve imports to the absolute path of the file.
 * Return 'null' if unable to resolve and we will attempt the next resolver in the chain.
 */
export type Resolver = (params: ResolverParams) => Promise<ResolverResult | null>
