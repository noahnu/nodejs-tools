import fs from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import path from 'node:path'

import { TSESTree, parse, simpleTraverse } from '@typescript-eslint/typescript-estree'
import createDebug from 'debug'
import micromatch from 'micromatch'

import {
    type ImportDescriptor,
    ImportDescriptorKind,
    ImportDescriptorSet,
} from '@noahnu/dependency-utils/structs'
import { type Resolver } from '@noahnu/dependency-utils/types'

import { resolveRealpath } from '../utils.mjs'

const debug = createDebug('dependency-utils:walk')

const DEFAULT_DEPTH_LIMIT = -1 // no depth limit
const VALID_EXTENSIONS = new Set<string>(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'])

export interface DependencyTreeItem extends ImportDescriptor {
    /** The resolved dependency path. */
    dependency: string
}

export interface WalkDependencyTreeOptions {
    resolvers?: Resolver[]
    visited?: Set<string>
    depth?: number
    ignorePatterns?: string[]
    /** Whether to include NodeJS builtins. */
    includeBuiltins?: boolean
}

export async function* walkDependencyTree(
    source: string,
    {
        resolvers,
        visited,
        depth = DEFAULT_DEPTH_LIMIT,
        ignorePatterns,
        includeBuiltins = false,
    }: WalkDependencyTreeOptions = {},
): AsyncGenerator<DependencyTreeItem, void, void> {
    const ext = path.extname(source).substring(1)
    if (!VALID_EXTENSIONS.has(ext)) {
        debug(`${source}: Unknown file extension '${ext}' [skipping]`)
        return
    }

    // Convert to realpath if possible
    source = await resolveRealpath(source)

    const visitedSet = visited ?? new Set<string>()
    if (visitedSet.has(source)) return
    visitedSet.add(source)

    const code = await fs.promises.readFile(source, { encoding: 'utf-8' })
    const ast = parse(code, {
        allowInvalidAST: true,
        comment: false,
        suppressDeprecatedPropertyWarnings: true,
        errorOnUnknownASTType: false,
        filePath: source,
        jsDocParsingMode: 'none',
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
        jsx: ['jsx', 'tsx'].includes(ext),
    })

    const imports = new ImportDescriptorSet()

    const visitors: Record<
        string,
        (node: TSESTree.Node, parent: TSESTree.Node | undefined) => void
    > = {
        [TSESTree.AST_NODE_TYPES.ImportDeclaration]: (node) => {
            if (node.type === TSESTree.AST_NODE_TYPES.ImportDeclaration) {
                imports.add({
                    kind: ImportDescriptorKind.Import,
                    source: node.source.value,
                })
            }
        },
        [TSESTree.AST_NODE_TYPES.CallExpression]: (node) => {
            if (
                node.type === TSESTree.AST_NODE_TYPES.CallExpression &&
                node.callee.type === TSESTree.AST_NODE_TYPES.Identifier &&
                node.callee.name === 'require'
            ) {
                const arg = node.arguments[0]
                if (arg.type === TSESTree.AST_NODE_TYPES.Literal) {
                    if (typeof arg.value === 'string') {
                        imports.add({
                            kind: ImportDescriptorKind.Require,
                            source: arg.value,
                        })
                    }
                } else {
                    debug(
                        `${source}: Dynamic require expression found at ${node.loc?.start}:${node.loc?.end}`,
                    )
                }
            }
        },
        [TSESTree.AST_NODE_TYPES.ImportExpression]: (node) => {
            if (node.type === TSESTree.AST_NODE_TYPES.ImportExpression) {
                if (node.source.type === TSESTree.AST_NODE_TYPES.Literal) {
                    if (typeof node.source.value === 'string') {
                        imports.add({
                            kind: ImportDescriptorKind.DynamicImport,
                            source: node.source.value,
                        })
                    }
                } else if (
                    node.source.type === TSESTree.AST_NODE_TYPES.TemplateLiteral &&
                    !node.source.expressions.length &&
                    node.source.quasis.length === 1
                ) {
                    imports.add({
                        kind: ImportDescriptorKind.DynamicImport,
                        source: node.source.quasis[0].value.cooked,
                    })
                } else {
                    // We're seeing node.loc occasionally be null
                    debug(
                        `${source}: Dynamic import expression found at ${node.loc?.start}:${node.loc?.end}`,
                    )
                }
            }
        },
    }

    for (const body of ast.body) {
        simpleTraverse(body, { visitors })
    }

    const resolveToAbsPath = async (request: string): Promise<string | undefined> => {
        for (const resolver of resolvers ?? []) {
            const resolution = await resolver({ context: source, request })
            if (resolution) {
                return path.resolve(resolution.result)
            }
        }

        try {
            const require = createRequire(source)
            return require.resolve(request)
        } catch (err) {
            console.error(err)
        }

        return undefined
    }

    for (const importValue of imports.values()) {
        if (isBuiltin(importValue.source)) {
            if (includeBuiltins) {
                yield {
                    ...importValue,
                    dependency: importValue.source.startsWith('node:')
                        ? importValue.source
                        : `node:${importValue.source}`,
                }
            }
            continue
        }

        if (ignorePatterns && micromatch.isMatch(importValue.source, ignorePatterns)) {
            // ignorePatterns is used on the initial request so it doesn't get to the resolvers
            // as well as on the returned result
            continue
        }

        const absPath = await resolveToAbsPath(importValue.source)
        if (absPath) {
            if (ignorePatterns && micromatch.isMatch(absPath, ignorePatterns)) {
                continue
            }

            yield { ...importValue, dependency: absPath }
            if (depth === -1 || depth > 0) {
                yield* walkDependencyTree(absPath, {
                    resolvers,
                    visited: visitedSet,
                    depth: depth === -1 ? depth : depth - 1,
                    ignorePatterns,
                })
            }
        } else {
            debug(`${source}: Unable to resolve '${importValue.source}'`)
        }
    }
}
