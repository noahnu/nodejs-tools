# @noahnu/yarn-dependency-checker


In a `dependencies-checker.config.yaml` file:

```yaml
workspaces:
    - "{@some/package,}"
devFiles:
    - "**/*.stories.*"
exclude:
    - "**/*.yarn"
include:
    - "**/src"
ignorePackages:
    - "@types/*"
```

and then:

```sh
yarn dlx @noahnu/yarn-dependency-checker --config=dependencies-checker.config.yaml
```


## Development

```sh
yarn workspace @noahnu/yarn-dependency-checker run-local --cwd <path-to-project> --dry-run
```

e.g.

```sh
yarn workspace @noahnu/yarn-dependency-checker run-local --cwd <repo> --workspaces "{@some/package,}" --dev-files '**/*.stories.*' --dev-files '**/testUtils/**' --ignore-packages '@types/*'
```
