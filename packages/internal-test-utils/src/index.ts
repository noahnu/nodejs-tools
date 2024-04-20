import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
Symbol.asyncDispose ??= Symbol.for('asyncDispose')

export interface TempDirContext {
    dir: string
    writeFile: (name: string, contents: string) => Promise<string>
}

export async function createTempDir(): Promise<TempDirContext & AsyncDisposable> {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nodejs-tools-'))

    return {
        dir,
        async writeFile(name: string, contents: string) {
            const filename = path.join(dir, name)
            await fs.promises.mkdir(path.dirname(filename), { recursive: true })
            await fs.promises.writeFile(filename, contents, { encoding: 'utf-8' })
            return filename
        },
        async [Symbol.asyncDispose]() {
            try {
                await fs.promises.rm(dir, { recursive: true })
            } catch {}
        },
    }
}
