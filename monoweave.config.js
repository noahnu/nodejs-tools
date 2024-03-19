// @ts-check

/** @type {import('@monoweave/types').MonoweaveConfigFile} */
const config = {
    preset: 'monoweave/preset-manual',
    maxConcurrentWrites: 1,
    changesetIgnorePatterns: ['**/*.test.ts'],
    commitIgnorePatterns: ['\\[skip-ci\\]'],
}

module.exports = config
