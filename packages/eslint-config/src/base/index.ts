import { type ESLint } from 'eslint'

const rules: ESLint.ConfigData['rules'] = {
    /* Prettier Overrides */
    'prettier/prettier': [
        'error',
        {
            printWidth: 100,
            tabWidth: 4,
            semi: false,
            trailingComma: 'all' /* Reduces git diff. */,
            singleQuote: true,
            arrowParens: 'always', // Reduces character diff when adding Typescript types.
        },
    ],

    /* Variables */
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-vars': 'off', // Prefer equivalent rule from @typescript-eslint */
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            /* By ignoring rest siblings, we support using `...rest` as an alternative to
             * a 3rd party omit function, to omit keys from an object. */
            ignoreRestSiblings: true,
            // The following allows us to maintain args for type purposes without needing to use them,
            //  for example, a reducer in which the action is typed but we don't use the action in the
            //  reducer
            argsIgnorePattern: '^_',
            // The alternative to this is to use empty array syntax, such as const [, , thing] = someArr
            //  this syntax lets you at least name the unused parameters which reads a bit nicer, i.e.
            //  const [_first, _second, third] = someArr
            destructuredArrayIgnorePattern: '^_',
        },
    ],

    /* Strings */
    quotes: ['error', 'single', { avoidEscape: true }],
    'prefer-template': 'error',

    /* Naming Convention */
    camelcase: 'off', // disabled in favour of @typescript-eslint's version
    '@typescript-eslint/naming-convention': 'off', // to enable this, we require a deeper exploration of our naming patterns

    /* Object Properties */
    'dot-notation': 'error',
    'no-useless-computed-key': 'error',
    'no-import-assign': 'warn',

    /* Conditionals */
    eqeqeq: 'error',
    'no-nested-ternary': 'error',

    /* Behaviours */
    /*
     * Rule: Disallow empty function blocks.
     * Reason Disabled: Useful for try..catch{} where we don't care about failure.
     */
    '@typescript-eslint/no-empty-function': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],

    /* Broken Rules */
    /*
     * Rule: Disallow assignments that can lead to race conditions.
     * Reason Disabled: The rule is broken and leads to many false positives.
     *   See: https://github.com/eslint/eslint/issues/11899
     */
    'require-atomic-updates': 'off',

    /* Imports */
    'no-duplicate-imports': 'error',
    'sort-imports': [
        'error',
        {
            /* Prefer import/order declaration sort due to autofixer */
            ignoreDeclarationSort: true,
        },
    ],
    'import-x/newline-after-import': 'error',
    'import-x/no-absolute-path': 'error',
    'import-x/no-duplicates': 'error',
    'import-x/no-mutable-exports': 'error',
    'import-x/no-self-import': 'error',
    'import-x/no-useless-path-segments': 'error',
    'import-x/no-unresolved': 'error',
    'import-x/order': [
        'error',
        {
            alphabetize: { order: 'asc' },
            'newlines-between': 'always',
            groups: ['unknown', 'builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        },
    ],

    /* Typescript Types */
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/ban-ts-comment': 'warn', // Discourage disabling static analysis.
    '@typescript-eslint/ban-types': 'warn', // Discourage disabling static analysis.
    '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-duplicate-enum-values': 'error',
    '@typescript-eslint/no-for-in-array': 'error',
    '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-includes': 'error',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-ts-expect-error': 'error',

    // no-use-before-define can cause errors with typescript concepts, like types or enums
    'no-use-before-define': 'off',
    // functions can be called before they are defined because function declarations are hoisted
    '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
}

const jsIncompatibleRules: ESLint.ConfigData['rules'] = {
    /*
     * Rule: Disallow require statements in favour of import statements.
     * Reason Disabled: We don't know if JS files are transpiled, so don't bother enforcing TS import syntax.
     */
    '@typescript-eslint/no-var-requires': 'off',
}

const config: ESLint.ConfigData = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['import-x', 'prettier', '@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/stylistic',
        'plugin:import-x/recommended',
        'plugin:import-x/typescript',
        // prettier must be the last item in this list to prevent conflicts
        'prettier',
    ],
    env: {
        node: true,
        es2024: true,
    },
    rules,
    overrides: [
        {
            files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
            rules: jsIncompatibleRules,
        },
    ],
    settings: {
        'import-x/external-module-folders': ['node_modules', '.yarn'],
        'import-x/resolver': [
            {
                [require.resolve('eslint-import-resolver-typescript')]: {
                    alwaysTryTypes: true,
                },
            },
            { [require.resolve('@noahnu/eslint-import-resolver-require')]: {} },
        ],
    },
}

export = config
