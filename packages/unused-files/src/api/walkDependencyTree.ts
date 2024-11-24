import fs from 'node:fs'
import path from 'node:path'

import { TSESTree, parse, simpleTraverse } from '@typescript-eslint/typescript-estree'
import createDebug from 'debug'
import micromatch from 'micromatch'

import { type Resolver } from './types'

const debug = createDebug('unused-files:parse')

const DEFAULT_DEPTH_LIMIT = -1 // no depth limit
const VALID_EXTENSIONS = new Set<string>(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'])

export async function* walkDependencyTree(
    source: string,
    {
        resolvers,
        visited,
        depth = DEFAULT_DEPTH_LIMIT,
        ignorePatterns,
    }: {
        resolvers?: Resolver[]
        visited?: Set<string>
        depth?: number
        ignorePatterns?: string[]
    } = {},
): AsyncGenerator<{ source: string; dependency: string }, void, void> {
    const ext = path.extname(source).substring(1)
    if (!VALID_EXTENSIONS.has(ext)) {
        debug(`${source}: Unknown file extension '${ext}' [skipping]`)
        return
    }

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
    })

    const importFroms = new Set<string>()

    const visitors: Record<
        string,
        (node: TSESTree.Node, parent: TSESTree.Node | undefined) => void
    > = {
        [TSESTree.AST_NODE_TYPES.ImportDeclaration]: (node) => {
            if (node.type === TSESTree.AST_NODE_TYPES.ImportDeclaration) {
                importFroms.add(node.source.value)
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
                        importFroms.add(arg.value)
                    }
                } else {
                    debug(
                        `${source}: Dynamic require expression found at ${node.loc.start}:${node.loc.end}`,
                    )
                }
            }
        },
        [TSESTree.AST_NODE_TYPES.ImportExpression]: (node) => {
            if (node.type === TSESTree.AST_NODE_TYPES.ImportExpression) {
                if (node.source.type === TSESTree.AST_NODE_TYPES.Literal) {
                    if (typeof node.source.value === 'string') {
                        importFroms.add(node.source.value)
                    }
                } else if (
                    node.source.type === TSESTree.AST_NODE_TYPES.TemplateLiteral &&
                    !node.source.expressions.length &&
                    node.source.quasis.length === 1
                ) {
                    importFroms.add(node.source.quasis[0].value.cooked)
                } else {
                    debug(
                        `${source}: Dynamic import expression found at ${node.loc.start}:${node.loc.end}`,
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
            return require.resolve(request, { paths: [path.dirname(source)] })
        } catch {}

        return undefined
    }

    for (const importFrom of Array.from(importFroms)) {
        const absPath = await resolveToAbsPath(importFrom)
        if (absPath) {
            if (ignorePatterns && micromatch.isMatch(absPath, ignorePatterns)) {
                continue
            }

            yield { dependency: absPath, source }
            if (depth === -1 || depth > 0) {
                yield* walkDependencyTree(absPath, {
                    resolvers,
                    visited: visitedSet,
                    depth: depth === -1 ? depth : depth - 1,
                    ignorePatterns,
                })
            }
        } else {
            debug(`${source}: Unable to resolve '${importFrom}'`)
        }
    }
}
