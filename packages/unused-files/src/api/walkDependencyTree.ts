import fs from 'node:fs'
import path from 'node:path'

import { TSESTree, parse, simpleTraverse } from '@typescript-eslint/typescript-estree'
import createDebug from 'debug'

const debug = createDebug('unused-files:parse')

const DEFAULT_DEPTH_LIMIT = -1 // no depth limit
const VALID_EXTENSIONS = new Set<string>(['ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs'])

export async function* walkDependencyTree(
    source: string,
    {
        aliases,
        visited,
        depth = DEFAULT_DEPTH_LIMIT,
    }: { aliases?: Partial<Record<string, string>>; visited?: Set<string>; depth?: number } = {},
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

    const resolveToAbsPath = (request: string): string | undefined => {
        const aliasedPath = aliases?.[request]
        if (aliasedPath) {
            return path.resolve(aliasedPath)
        }

        try {
            return require.resolve(request, { paths: [path.dirname(source)] })
        } catch {}
        return undefined
    }

    for (const importFrom of Array.from(importFroms)) {
        const absPath = resolveToAbsPath(importFrom)
        if (absPath) {
            yield { dependency: absPath, source }
            if (depth === -1 || depth > 0) {
                yield* walkDependencyTree(absPath, {
                    aliases,
                    visited: visitedSet,
                    depth: depth === -1 ? depth : depth - 1,
                })
            }
        } else {
            debug(`${source}: Unable to resolve '${importFrom}'`)
        }
    }
}
