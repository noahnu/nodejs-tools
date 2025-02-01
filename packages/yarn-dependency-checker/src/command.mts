import path from 'node:path'

import { resolveRealpath, walkDependencyTree } from '@noahnu/dependency-utils'
import { getPluginConfiguration } from '@yarnpkg/cli'
import {
    type CommandContext,
    Configuration,
    MessageName,
    Project,
    type Report,
    StreamReport,
    type Workspace,
    structUtils,
} from '@yarnpkg/core'
import { npath } from '@yarnpkg/fslib'
import { Command, Option, type Usage } from 'clipanion'
import fg from 'fast-glob'
import micromatch from 'micromatch'

interface IssueReport {
    missingDependencies: Set<string>
    missingDevDependencies: Set<string>

    moveFromDependencyToDev: Set<string>
    moveFromDevToDependency: Set<string>
}

class DependencyCheckerCommand extends Command<CommandContext> {
    static paths = []

    static usage: Usage = Command.Usage({
        description: '',
        details: '',
        examples: [],
    })

    cwd?: string = Option.String('--cwd', { required: false })

    workspaces?: string[] = Option.Array('--workspaces', { required: false })

    devFilesPatterns?: string[] = Option.Array('--dev-files', { required: false })

    exclude = Option.Array('--exclude', {
        description:
            'Glob patterns usued to exclude files. ' +
            'The patterns are applied during traversal ' +
            'of the directory tree.',
        required: false,
    })

    include = Option.Array('--include', {
        description: 'Glob patterns usued to include files.',
        required: false,
    })

    ignorePackages = Option.Array('--ignore-packages', {
        description: 'Glob used to ignore packages.',
        required: false,
    })

    #ignorePatterns: string[] = []
    #includePatterns: string[] = []
    #devFilePatterns: string[] = []
    #ignorePackages: string[] = []

    async execute(): Promise<number> {
        const cwd = npath.toPortablePath(this.cwd ?? process.cwd())
        process.chdir(cwd)

        this.#ignorePatterns = ['**/node_modules', '**/dist', ...(this.exclude ?? [])]
        this.#includePatterns = this.include ?? ['**/*.{ts,js,mjs,cjs,mts,cts,jsx,tsx}']
        this.#devFilePatterns = [
            '**/*.test.*',
            '**/*.spec.*',
            '**/__tests__/**',
            ...(this.devFilesPatterns ?? []),
        ]
        this.#ignorePackages = [...(this.ignorePackages ?? ['node:*'])]

        try {
            const configuration = await Configuration.find(cwd, getPluginConfiguration())
            const { project, workspace } = await Project.find(configuration, cwd)

            await project.restoreInstallState()

            const pipeline = async (report: Report) => {
                if (!workspace && !this.workspaces?.length) {
                    throw new Error('Must be run from within a workspace.')
                }

                const allWorkspaceIdents = project.workspaces
                    .filter((w) => w.manifest.name)
                    .map((w) => structUtils.stringifyIdent(w.manifest.name!))

                const workspaces = this.workspaces?.length
                    ? new Set<Workspace>(
                          micromatch(allWorkspaceIdents, this.workspaces)
                              .map((ident) =>
                                  project.tryWorkspaceByIdent(structUtils.parseIdent(ident)),
                              )
                              .filter((v): v is Workspace => Boolean(v)),
                      )
                    : new Set<Workspace>([workspace!])

                if (!workspaces.size) {
                    throw new Error('No workspaces selected.')
                }

                for (const workspace of workspaces) {
                    // Skip top-level workspace (can make a cli flag to toggle this behaviour in the future)
                    if (
                        structUtils.areDescriptorsEqual(
                            project.topLevelWorkspace.anchoredDescriptor,
                            workspace.anchoredDescriptor,
                        )
                    ) {
                        continue
                    }

                    const workspaceName = workspace.manifest.name
                        ? structUtils.stringifyIdent(workspace.manifest.name)
                        : 'Unknown'

                    await report.startTimerPromise<void>(
                        `[${workspaceName}]`,
                        { skipIfEmpty: true },
                        async () => {
                            const issueReport = await this.checkForIssues({ workspace })

                            if (issueReport.missingDependencies.size) {
                                report.reportError(
                                    MessageName.UNNAMED,
                                    `Missing dependencies: ${Array.from(issueReport.missingDependencies.values()).join(', ')}.`,
                                )
                            }
                            if (issueReport.missingDevDependencies.size) {
                                report.reportError(
                                    MessageName.UNNAMED,
                                    `Missing dev dependencies: ${Array.from(issueReport.missingDevDependencies.values()).join(', ')}.`,
                                )
                            }
                        },
                    )
                }
            }

            const report = await StreamReport.start(
                { configuration, stdout: this.context.stdout },
                pipeline,
            )

            return report.exitCode()
        } catch (err) {
            this.context.stderr.write(`${String(err)}\n`)
            return 1
        }
    }

    private async checkForIssues({ workspace }: { workspace: Workspace }): Promise<IssueReport> {
        const cwd = npath.fromPortablePath(workspace.cwd)

        const globFromSource = async (source: string): Promise<string[]> => {
            const files = await fg.glob(
                fg.isDynamicPattern(source) ? source : path.join(source, '**'),
                {
                    dot: false,
                    ignore: this.#ignorePatterns,
                    absolute: true,
                    cwd,
                },
            )

            return Promise.all(files.map(async (file) => await resolveRealpath(file)))
        }

        const files = new Set<string>(
            ([] as string[]).concat(
                ...(await Promise.all<string[]>(
                    this.#includePatterns.map((source) => globFromSource(source)),
                )),
            ),
        )

        const visitedFiles = new Set<string>()
        const dependencies = new Set<string>()
        const devDependencies = new Set<string>()

        for (const file of files) {
            const currentFile = await resolveRealpath(path.resolve(cwd, file))

            for await (const { source } of walkDependencyTree(currentFile, {
                depth: 0,
                includeBuiltins: false,
                visited: visitedFiles,
            })) {
                const pkgName = source.match(/^((@[^/]+\/[^/]+)|([^/]+))/)?.[1]
                if (!pkgName) continue

                // Invalid name
                if (!structUtils.tryParseIdent(pkgName) || !pkgName.match(/^[@a-z]/i)) {
                    continue
                }

                // Allow self-reference
                if (
                    workspace.manifest.name &&
                    pkgName === structUtils.stringifyIdent(workspace.manifest.name)
                ) {
                    continue
                }

                if (micromatch.isMatch(pkgName, this.#ignorePackages)) {
                    continue
                }

                const isDevFile = micromatch.isMatch(file, this.#devFilePatterns)
                if (isDevFile) {
                    devDependencies.add(pkgName)
                } else {
                    dependencies.add(pkgName)
                }
            }
        }

        const issueReport: IssueReport = {
            missingDependencies: new Set(),
            missingDevDependencies: new Set(),

            moveFromDependencyToDev: new Set(),
            moveFromDevToDependency: new Set(),
        }

        for (const dep of dependencies.values()) {
            const identHash = structUtils.parseIdent(dep).identHash

            // Check for the dependency as a direct dependency or peer
            if (
                !workspace.manifest.dependencies.has(identHash) &&
                !workspace.manifest.peerDependencies.has(identHash)
            ) {
                issueReport.missingDependencies.add(dep)

                // Dependency has been miscategorized
                if (workspace.manifest.devDependencies.has(identHash)) {
                    issueReport.moveFromDevToDependency.add(dep)
                }
            }
        }

        for (const dep of devDependencies.values()) {
            const identHash = structUtils.parseIdent(dep).identHash

            // Check for the dependency as a dev dependency or regular dependency
            if (
                !workspace.manifest.devDependencies.has(identHash) &&
                !workspace.manifest.dependencies.has(identHash) &&
                // If we've already marked it as a missing dependency, no need to flag it for dev
                !issueReport.missingDependencies.has(dep)
            ) {
                issueReport.missingDevDependencies.add(dep)
            }

            // If the dependency is in dependencies, but it's only used in dev files, it's
            // miscategorized
            if (workspace.manifest.dependencies.has(identHash) && !dependencies.has(dep)) {
                issueReport.moveFromDependencyToDev.add(dep)
            }
        }

        return issueReport
    }
}

export { DependencyCheckerCommand }
