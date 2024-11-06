import { builtinModules } from 'module'
import path from 'path'

import debug from 'debug'
import { resolve as resolveNode } from 'eslint-import-resolver-node'

const log = debug('eslint-import-resolver-require')

const builtins = new Set(builtinModules)

type Resolver = (
    source: string,
    file: string,
    config: unknown,
) => { found: true; path: string | null } | { found: false }

const resolve: Resolver = (source: string, file: string, config: unknown) => {
    if (builtins.has(source)) {
        return { found: true, path: null }
    }

    try {
        let moduleId = require.resolve(source, { paths: [path.dirname(file)] })
        if (process.versions.pnp && moduleId.includes('__virtual__')) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            moduleId = require('pnpapi').resolveVirtual(moduleId)
        }
        return { found: true, path: moduleId }
    } catch (err) {
        log('falling back to eslint-import-resolver-node due to error', err)
        // Fallback to eslint-import-resolver-node plugin
        return resolveNode(source, file, config)
    }
}

export = {
    interfaceVersion: 2,
    resolve,
}
