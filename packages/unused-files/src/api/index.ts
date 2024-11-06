import fs from 'node:fs'
import path from 'node:path'

import createDebug from 'debug'
import fg from 'fast-glob'

import { walkDependencyTree } from './walkDependencyTree'

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
     * Custom aliases that are consulted first before attempting to resolve the import path.
     * It is recommended to rely on package.json aliases over these custom ones.
     */
    aliases?: Partial<Record<string, string>>

    /**
     * Maximum depth to traverse. -1 can be used to disable the depth limit (the default).
     */
    depth?: number

    cwd?: string
}

export interface UnusedFilesResult {
    unusedFiles: string[]
}

export async function findUnusedFiles({
    entryFiles,
    ignorePatterns = ['**/node_modules'],
    sourceDirectories = [],
    aliases,
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

    for (const entryFile of entryFiles) {
        const entry = await fs.promises.realpath(path.resolve(cwd, entryFile))

        unvisitedFiles.delete(entry)

        for await (const { source, dependency } of walkDependencyTree(entry, {
            aliases,
            depth,
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
        unusedFiles: Array.from(unvisitedFiles)
            .map((abspath) => path.relative(cwd, abspath))
            .sort(),
    }
}
