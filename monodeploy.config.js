// @ts-check

/** @type {import('@monodeploy/types').RecursivePartial<import('@monodeploy/types').MonodeployConfiguration>} */
const config = {
    conventionalChangelogConfig: '@tophat/conventional-changelog-config',
    maxConcurrentWrites: 1,
    changelogFilename: '<packageDir>/CHANGELOG.md',
    autoCommit: true,
    autoCommitMessage: 'chore: release [skip ci]',
    git: {
        push: true,
        tag: true,
    },
    persistVersions: true,
    changesetIgnorePatterns: ['**/*.test.ts'],
    commitIgnorePatterns: ['\\[skip-ci\\]'],
}

module.exports = config
