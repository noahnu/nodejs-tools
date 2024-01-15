# @noahnu/unused-files

## Usage

```sh
DEBUG=unused-files yarn dlx @noahnu/unused-files --entry src/index.ts --ignore '**/node_modules' --ignore '**/dist' --depth 10 ./src
```

Or use the Node API:

```ts
import { findUnusedFiles } from '@noahnu/unused-files'

const result = await findUnusedFiles({
    entryFiles: ['src/index.ts'],

    // optional
    sourceDirectories: [process.cwd()],
    ignorePatterns: ['**/node_modules'],
    aliases: {
        '@my/alias': 'path/to/file/index.ts',
    },
    depth: 10,
})

console.log(result.unusedFiles.join('\n'))
```

## Development

```sh
yarn workspace @noahnu/unused-files run-local
```
