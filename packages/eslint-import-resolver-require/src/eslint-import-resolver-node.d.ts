declare module 'eslint-import-resolver-node' {
    export const resolve: (
        source: string,
        file: string,
        config: unknown,
    ) => { found: true; path: string | null } | { found: false }
}
