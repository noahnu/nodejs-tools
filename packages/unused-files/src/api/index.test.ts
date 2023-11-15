import { describe, expect, it } from '@jest/globals'
import { createTempDir } from '@noahnu/internal-test-utils'

import { findUnusedFiles } from '.'

describe('findUnusedFiles', () => {
    it('reports no unused files on single file project', async () => {
        await using context = await createTempDir()

        await context.writeFile('entry.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.unusedFiles).toHaveLength(0)
    })

    it('reports no unused files if all files are imported by entry', async () => {
        await using context = await createTempDir()

        await context.writeFile(
            'entry.ts',
            ['import { A } from "./depA"', 'import { B } from "./depB"'].join('\n'),
        )
        await context.writeFile('depA.ts', 'console.log()')
        await context.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.unusedFiles).toHaveLength(0)
    })

    it('reports no unused files if at least one file imports the file', async () => {
        await using context = await createTempDir()

        await context.writeFile('entry.ts', 'import { A } from "./depA"')
        await context.writeFile('depA.ts', 'import { B } from "./depB"')
        await context.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.unusedFiles).toHaveLength(0)
    })

    it('reports unused files when no file imports the file', async () => {
        await using context = await createTempDir()

        await context.writeFile('entry.ts', 'import { A } from "./depA"')
        await context.writeFile('depA.ts', 'console.log()')
        await context.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.unusedFiles).toHaveLength(1)
        expect(result.unusedFiles).toContain('depB.ts')
    })

    it('supports require calls', async () => {
        await using context = await createTempDir()

        await context.writeFile(
            'entry.ts',
            ['import { A } from "./depA"', 'require("./depB")'].join('\n'),
        )
        await context.writeFile('depA.ts', 'console.log()')
        await context.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.unusedFiles).toHaveLength(0)
    })

    it('supports dynamic import calls', async () => {
        await using context = await createTempDir()

        await context.writeFile(
            'entry.ts',
            ['import { A } from "./depA"', 'import("./depB")'].join('\n'),
        )
        await context.writeFile('depA.ts', 'console.log()')
        await context.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.unusedFiles).toHaveLength(0)
    })
})
