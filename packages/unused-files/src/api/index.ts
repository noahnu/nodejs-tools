import fs from 'node:fs'
import path from 'node:path'

import createDebug from 'debug'
import fg from 'fast-glob'

import { type Resolver } from './types'
import { walkDependencyTree } from './walkDependencyTree'

export type { Resolver, ResolverResult, ResolverParams } from './types'

const debug = createDebug('unused-files')

export interface FindUnusedFilesOptions {
    /**
     * Entry files into the codebase. These files are known to be used and any files that
     * are dependencies of these entry files are also considered used files.
     */
    entryFiles: string[]

    /**
     * Directories to search for files within. Relative to the current working directory.
     */
    sourceDirectories?: string[]

    /**
     * Glob patterns used to exclude directories and files. Files which begin with
     * a dot (i.e. hidden) are ignored by default.
     */
    ignorePatterns?: string[]

    /**
     * Custom resolver to use to resolve an import path relative to a source file.
     * It is recommended to rely on package.json aliases over these custom ones
     * when possible.
     */
    resolvers?: Resolver[]

    /**
     * Maximum depth to traverse. -1 can be used to disable the depth limit (the default).
     */
    depth?: number

    cwd?: string
}

export interface UnusedFilesResult {
    used: string[]
    unused: string[]
}

export async function findUnusedFiles({
    entryFiles,
    ignorePatterns = ['**/node_modules'],
    sourceDirectories = [],
    resolvers,
    depth,
    cwd = process.cwd(),
}: FindUnusedFilesOptions): Promise<UnusedFilesResult> {
    cwd = await fs.promises.realpath(cwd)

    const globFromSource = async (source: string): Promise<string[]> => {
        const files = await fg.glob(
            fg.isDynamicPattern(source) ? source : path.join(source, '**'),
            {
                dot: false,
                ignore: ignorePatterns,
                absolute: true,
                cwd,
            },
        )

        return Promise.all(
            files.map(async (file) => await fs.promises.realpath(file).catch(() => file)),
        )
    }

    const sourceDirs = sourceDirectories.length > 0 ? sourceDirectories : [cwd]

    const files = new Set<string>(
        ([] as string[]).concat(
            ...(await Promise.all<string[]>(sourceDirs.map((source) => globFromSource(source)))),
        ),
    )

    const unvisitedFiles = new Set<string>(files)
    const visitedFiles = new Set<string>()

    for (const entryFile of entryFiles) {
        const entry = await fs.promises.realpath(path.resolve(cwd, entryFile))

        unvisitedFiles.delete(entry)

        for await (const { source, dependency } of walkDependencyTree(entry, {
            resolvers,
            depth,
            visited: visitedFiles,
            ignorePatterns,
        })) {
            let resolvedDependency = dependency

            if (files.has(dependency)) {
                debug(`${source}: ${dependency} [dependency]`)
            } else {
                const realpath = await fs.promises.realpath(dependency)
                if (files.has(realpath)) {
                    resolvedDependency = realpath
                } else {
                    debug(`${source}: ${dependency} [unknown dependency]`)
                }
            }

            unvisitedFiles.delete(resolvedDependency)
        }
    }

    return {
        unused: Array.from(unvisitedFiles)
            .map((abspath) => path.relative(cwd, abspath))
            .sort(),
        used: Array.from(visitedFiles)
            .map((abspath) => path.relative(cwd, abspath))
            .sort(),
    }
}
