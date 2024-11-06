# @noahnu/eslint-config

## Usage

In your `.eslintrc.js` file:

```js
module.exports = {
    extends: '@noahnu/eslint-config',
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
    },
};
```
