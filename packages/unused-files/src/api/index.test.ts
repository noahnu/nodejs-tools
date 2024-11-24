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

        expect(result.used).toHaveLength(1)
        expect(result.unused).toHaveLength(0)
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

        expect(result.used).toHaveLength(3)
        expect(result.unused).toHaveLength(0)
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

        expect(result.used).toHaveLength(3)
        expect(result.unused).toHaveLength(0)
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

        expect(result.used).toHaveLength(2)
        expect(result.unused).toHaveLength(1)
        expect(result.unused).toContain('depB.ts')
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

        expect(result.used).toHaveLength(3)
        expect(result.unused).toHaveLength(0)
    })

    it('supports dynamic import calls (literals)', async () => {
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

        expect(result.used).toHaveLength(3)
        expect(result.unused).toHaveLength(0)
    })

    it('supports dynamic import calls (template literals)', async () => {
        await using context = await createTempDir()

        await context.writeFile(
            'entry.ts',
            ['import { A } from "./depA"', 'import(`./depB`)'].join('\n'),
        )
        await context.writeFile('depA.ts', 'console.log()')
        await context.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: context.dir,
        })

        expect(result.used).toHaveLength(3)
        expect(result.unused).toHaveLength(0)
    })

    it('supports custom resolvers', async () => {
        await using tmpDir = await createTempDir()

        await tmpDir.writeFile(
            'entry.ts',
            ['import { A } from "@my/alias-a"', 'import { B } from "./depB"'].join('\n'),
        )
        const depA = await tmpDir.writeFile('depA.ts', 'console.log()')
        await tmpDir.writeFile('depB.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: tmpDir.dir,
            resolvers: [
                async ({ request }) => {
                    if (request === '@my/alias-a') {
                        return { result: depA }
                    }
                    return null
                },
            ],
        })

        expect(result.used).toHaveLength(3)
        expect(result.unused).toHaveLength(0)
    })

    it('does not visit ignored files', async () => {
        await using tmpDir = await createTempDir()

        await tmpDir.writeFile(
            'entry.ts',
            ['import { A } from "./badFile"', 'import { B } from "./depB"'].join('\n'),
        )
        await tmpDir.writeFile('badFile.ts', 'import "depC.ts"')
        await tmpDir.writeFile('depB.ts', 'console.log()')
        await tmpDir.writeFile('depC.ts', 'console.log()')

        const result = await findUnusedFiles({
            entryFiles: ['entry.ts'],
            cwd: tmpDir.dir,
            ignorePatterns: ['**/badFile.*'],
        })

        expect(result.used).toHaveLength(2)
        expect(result.used).toEqual(expect.arrayContaining(['entry.ts', 'depB.ts']))

        expect(result.unused).toHaveLength(1)
        // since badFile is ignored
        expect(result.unused).toEqual(expect.arrayContaining(['depC.ts']))
    })
})
