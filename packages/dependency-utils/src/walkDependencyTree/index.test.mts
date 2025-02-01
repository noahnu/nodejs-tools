import { describe, expect, it } from '@jest/globals'
import { createTempDir } from '@noahnu/internal-test-utils'

import { ImportDescriptorKind } from '../index.mjs'

import { type DependencyTreeItem, walkDependencyTree } from './index.mjs'

describe('walkDependencyTree', () => {
    it('detects dynamic imports', async () => {
        await using context = await createTempDir()

        const file = await context.writeFile('file.ts', ['import("node:fs")'].join('\n'))

        const imports = await Array.fromAsync(walkDependencyTree(file, { includeBuiltins: true }))
        expect(imports).toEqual(
            expect.arrayContaining([
                {
                    kind: ImportDescriptorKind.DynamicImport,
                    source: 'node:fs',
                    dependency: '',
                } satisfies DependencyTreeItem,
            ]),
        )
    })

    it('detects require statements', async () => {
        await using context = await createTempDir()

        const file = await context.writeFile('file.ts', ['require("node:fs")'].join('\n'))

        const imports = await Array.fromAsync(walkDependencyTree(file, { includeBuiltins: true }))
        expect(imports).toEqual(
            expect.arrayContaining([
                {
                    kind: ImportDescriptorKind.Require,
                    source: 'node:fs',
                    dependency: '',
                } satisfies DependencyTreeItem,
            ]),
        )
    })

    it('detects import statements', async () => {
        await using context = await createTempDir()

        await context.writeFile('relative.js', 'export default {}')
        const file = await context.writeFile(
            'file.ts',
            ['import x from "./relative.js"'].join('\n'),
        )

        const imports = await Array.fromAsync(walkDependencyTree(file, { includeBuiltins: true }))
        expect(imports).toEqual(
            expect.arrayContaining([
                {
                    kind: ImportDescriptorKind.Import,
                    source: './relative.js',
                    dependency: expect.stringContaining('relative.js') as unknown as string,
                } satisfies DependencyTreeItem,
            ]),
        )
    })
})
