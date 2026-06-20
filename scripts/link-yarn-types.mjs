import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const typesRoot = dirname(dirname(require.resolve('@types/node/package.json')))
const linkPath = join(root, '.yarn/types/@types')

await mkdir(dirname(linkPath), { recursive: true })

try {
  if ((await lstat(linkPath)).isSymbolicLink()) {
    await rm(linkPath)
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error
  }
}

await symlink(typesRoot, linkPath, 'dir')
