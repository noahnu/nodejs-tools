# @noahnu/yarn-dependency-checker

## Development

```sh
yarn workspace @noahnu/yarn-dependency-checker run-local --cwd <path-to-project> --dry-run
```

e.g.

```sh
yarn workspace @noahnu/yarn-dependency-checker run-local --cwd <repo> --workspaces "{@some/package,}" --dev-files '**/*.stories.*' --dev-files '**/testUtils/**' --ignore-packages '@types/*'
```
