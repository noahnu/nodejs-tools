// @ts-check

/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require('@yarnpkg/types')

/**
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Context} Context
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Workspace} Workspace
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Dependency} Dependency
 */

/**
 * Enforces required manifest fields for workspaces.
 *
 * @param {Context} context
 * @param {Record<string, string | ((workspace: Workspace) => string)>} fields
 */
function enforceFieldsOnAllWorkspaces({ Yarn }, fields) {
    for (const workspace of Yarn.workspaces()) {
        if (workspace.manifest.private) continue

        for (const [key, value] of Object.entries(fields)) {
            workspace.set(key, typeof value === 'function' ? value(workspace) : value)
        }
    }
}

module.exports = defineConfig({
    async constraints(ctx) {
        enforceFieldsOnAllWorkspaces(ctx, {
            license: 'MIT',
            'repository.type': 'git',
            'repository.url': 'https://github.com/noahnu/nodejs-tools.git',
            'repository.directory': (workspace) => workspace.cwd,
            'publishConfig.registry': 'https://registry.npmjs.org/',
            'publishConfig.access': 'public',
            'author.name': 'noahnu',
            'author.email': 'noah@noahnu.com',
            'author.url': 'https://noahnu.com',
            'scripts.clean': 'run workspace:clean "$(pwd)"',
            'scripts.prepack': 'run workspace:build "$(pwd)"',
        })
    },
})
