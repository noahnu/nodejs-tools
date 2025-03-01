import { getPluginConfiguration } from '@yarnpkg/cli'
import {
    Cache,
    type CommandContext,
    Configuration,
    type Descriptor,
    type DescriptorHash,
    type IdentHash,
    MessageName,
    Project,
    type Report,
    StreamReport,
    ThrowReport,
    type Workspace,
    miscUtils,
    structUtils,
} from '@yarnpkg/core'
import { npath, ppath, xfs } from '@yarnpkg/fslib'
import { suggestUtils } from '@yarnpkg/plugin-essentials'
import { Command, Option, type Usage } from 'clipanion'
import micromatch from 'micromatch'
import { type ReleaseType } from 'semver'
import semverDiff from 'semver/functions/diff'
import semverMinVersion from 'semver/ranges/min-version'

interface RuleConfig {
    // How many packages in the group to update. If false, do not impose a limit
    maxPackageUpdates: number | false
    // Whether to keep the upper limit of the semver range, or allow exceeding
    preserveSemVerRange: boolean
}

type RuleGlob = string

interface Config {
    rules: [RuleGlob, RuleConfig][]

    // Defaults to 1, though can be false to apply no limit
    maxRulesApplied: number | false

    // whether to skip changes that update the package.json but not installed dependencies
    skipManifestOnlyChanges: boolean
}

type RulesWithPackages = [RuleGlob, { rule: RuleConfig; packages: Set<IdentHash> }][]

type RulesWithUpdates = Map<RuleGlob, Map<IdentHash, Descriptor>>

interface ChangesetRecord {
    fromRange: string
    toRange: string
    fromVersion: string | null
    toVersion: string
    updateType: ReleaseType | null
}
type Changeset = Map<string, ChangesetRecord>

const ruleConfigDefaults: RuleConfig = {
    maxPackageUpdates: false,
    preserveSemVerRange: true,
}

class SemverUpCommand extends Command<CommandContext> {
    static paths = []

    static usage: Usage = Command.Usage({
        description: '',
        details: '',
        examples: [],
    })

    cwd?: string = Option.String('--cwd', { required: false })

    configFilename: string = Option.String('--config', 'semver-up.json')

    changesetFilename?: string = Option.String('--changeset', {
        required: false,
    })

    dryRun: boolean = Option.Boolean('--dry-run', false)

    preserveSemVerRange: boolean = Option.Boolean('--preserve-semver', true)

    include?: string[] = Option.Array('--include', { required: false })

    ruleGlobs: string[] = Option.Rest()

    async execute(): Promise<number> {
        const cwd = npath.toPortablePath(this.cwd ?? process.cwd())
        process.chdir(cwd)

        try {
            const configuration = await Configuration.find(cwd, getPluginConfiguration())
            const { project, workspace } = await Project.find(configuration, cwd)
            const cache = await Cache.find(configuration)

            await project.restoreInstallState()

            const config = await this.parseConfigFile()

            const pipeline = async (report: Report) => {
                if (!workspace && !this.include?.length) {
                    throw new Error('Must be run from within a workspace.')
                }

                const allWorkspaceIdents = project.workspaces
                    .filter((w) => w.manifest.name)
                    .map((w) => structUtils.stringifyIdent(w.manifest.name!))

                const workspaces = this.include?.length
                    ? new Set<Workspace>(
                          micromatch(allWorkspaceIdents, this.include)
                              .map((ident) =>
                                  project.tryWorkspaceByIdent(structUtils.parseIdent(ident)),
                              )
                              .filter((v): v is Workspace => Boolean(v)),
                      )
                    : new Set<Workspace>([workspace!])

                if (!workspaces.size) {
                    throw new Error('No workspaces selected.')
                }

                const changesets: Changeset[] = []
                for (const workspace of workspaces) {
                    const workspaceName = workspace.manifest.name
                        ? structUtils.stringifyIdent(workspace.manifest.name)
                        : 'Unknown'
                    const rulesWithPackages = (await report.startTimerPromise<RulesWithPackages>(
                        `[${workspaceName}] Processing Semver Up Rules`,
                        { skipIfEmpty: false },
                        async () =>
                            this.getRulesWithPackages({
                                config,
                                workspace,
                                report,
                            }),
                    )) as unknown as RulesWithPackages

                    const rulesWithUpdates = (await report.startTimerPromise<RulesWithUpdates>(
                        `[${workspaceName}] Finding Updates`,
                        { skipIfEmpty: false },
                        async () =>
                            this.findUpdateCandidates({
                                workspace,
                                rulesWithPackages,
                                cache,
                                configuration,
                                report,
                            }),
                    )) as unknown as RulesWithUpdates

                    const changeset = (await report.startTimerPromise<Changeset>(
                        `[${workspaceName}] Staging Updates`,
                        { skipIfEmpty: false },
                        async () =>
                            this.applyUpdates({
                                config,
                                workspace,
                                rulesWithUpdates,
                                report,
                            }),
                    )) as unknown as Changeset

                    changesets.push(changeset)
                }

                if (workspaces.size > 1 && this.changesetFilename) {
                    report.reportError(
                        MessageName.UNNAMED,
                        'Changesets not supported when targetting more than one workspace.',
                    )
                } else {
                    await report.startTimerPromise(
                        'Writing Changeset File',
                        { skipIfEmpty: true },
                        async () => {
                            await this.writeChangeset({
                                changeset: changesets[0],
                            })
                        },
                    )
                }

                if (!this.dryRun) {
                    await project.install({ cache, report })
                }
            }

            const plumbingMode = this.changesetFilename === '-'

            if (plumbingMode) {
                try {
                    await pipeline(new ThrowReport())
                } catch {
                    return 1
                }
                return 0
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

    async parseConfigFile(): Promise<Config> {
        const configPPath = ppath.resolve(ppath.cwd(), npath.toPortablePath(this.configFilename))

        let configFromFile: Record<string, unknown> = {}
        try {
            configFromFile = miscUtils.dynamicRequire(configPPath)
        } catch {
            // If no file and no command line args, default to match all packages
            configFromFile = {
                rules: [['*', {}]],
            }
        }

        const rulesFromFile = (configFromFile?.rules ?? []) as [RuleGlob, Partial<RuleConfig>][]

        const config: Config = {
            rules: rulesFromFile.map(([ruleGlob, rule]) => [
                ruleGlob,
                {
                    ...ruleConfigDefaults,
                    preserveSemVerRange: this.preserveSemVerRange,
                    ...rule,
                },
            ]),
            maxRulesApplied: (configFromFile?.maxRulesApplied as number | false | undefined) ?? 1,
            skipManifestOnlyChanges:
                (configFromFile?.skipManifestOnlyChanges as boolean | undefined) ?? false,
        }

        // overwrite rules with command line args
        if (this.ruleGlobs.length) {
            config.rules = []
            config.maxRulesApplied = false
            for (const ruleGlob of this.ruleGlobs) {
                config.rules.push([
                    ruleGlob,
                    {
                        ...ruleConfigDefaults,
                        preserveSemVerRange: this.preserveSemVerRange,
                    },
                ])
            }
        }

        return config
    }

    async getRulesWithPackages({
        config,
        workspace,
        report,
    }: {
        config: Config
        workspace: Workspace
        report: Report
    }): Promise<RulesWithPackages> {
        const manifest = workspace.manifest

        const ruleBuckets: RulesWithPackages = config.rules.map(([ruleGlob, rule]) => [
            ruleGlob,
            { rule, packages: new Set() },
        ])

        const allDependencies = [
            ...manifest.dependencies.entries(),
            ...manifest.devDependencies.entries(),
        ]

        const progress = StreamReport.progressViaCounter(allDependencies.length)
        const reportedProgress = report.reportProgress(progress)

        for (const [identHash, descriptor] of allDependencies) {
            const bucket = ruleBuckets.find(
                ([ruleGlob]) =>
                    micromatch([structUtils.stringifyIdent(descriptor)], ruleGlob).length > 0,
            )
            if (bucket) {
                bucket[1].packages.add(identHash)
            }
            progress.tick()
        }

        await reportedProgress

        return ruleBuckets
    }

    async findUpdateCandidates({
        workspace,
        rulesWithPackages,
        cache,
        configuration,
        report,
    }: {
        workspace: Workspace
        rulesWithPackages: RulesWithPackages
        cache: Cache
        configuration: Configuration
        report: Report
    }): Promise<RulesWithUpdates> {
        const descriptors = new Map<IdentHash, Descriptor>([
            ...workspace.manifest.dependencies.entries(),
            ...workspace.manifest.devDependencies.entries(),
        ])

        const groups: RulesWithUpdates = new Map()

        for (const [ruleGlob, { rule, packages }] of rulesWithPackages) {
            const updates = new Map<IdentHash, Descriptor>()

            const progress = StreamReport.progressViaCounter(packages.size)
            const reportedProgress = report.reportProgress(progress)

            for (const pkg of packages) {
                const oldDescriptor = descriptors.get(pkg)
                if (!oldDescriptor) {
                    progress.tick()
                    continue
                }

                const oldRange = structUtils.parseRange(oldDescriptor.range)
                const isSemverProtocol =
                    (oldRange.protocol === null &&
                        configuration.get('defaultProtocol') === 'npm:') ||
                    oldRange.protocol === 'npm:'

                if (!isSemverProtocol) {
                    progress.tick()
                    continue
                }

                const ident = structUtils.convertToIdent(oldDescriptor)
                const newDescriptor = await suggestUtils.fetchDescriptorFrom(
                    ident,
                    rule.preserveSemVerRange ? oldDescriptor?.range : 'latest',
                    {
                        project: workspace.project,
                        workspace,
                        preserveModifier: oldDescriptor?.range,
                        cache,
                    },
                )

                if (newDescriptor && oldDescriptor.range !== newDescriptor.range) {
                    updates.set(ident.identHash, newDescriptor)
                }

                progress.tick()
            }

            if (updates.size) {
                groups.set(ruleGlob, updates)
            }

            await reportedProgress
        }

        return groups
    }

    getInstalledVersion({
        descriptorHash,
        project,
    }: {
        descriptorHash: DescriptorHash
        project: Project
    }): string | null {
        const locatorHash = project.storedResolutions.get(descriptorHash)
        if (locatorHash) {
            const pkg = project.storedPackages.get(locatorHash)
            if (pkg) {
                return pkg.version
            }
        }
        return null
    }

    extractVersionFromRange(range: string): string {
        const minVersion = semverMinVersion(range, { loose: true })
        if (minVersion) {
            return minVersion.version
        }
        return range
    }

    getUpdateType({
        fromVersion,
        toVersion,
    }: {
        fromVersion: string | null
        toVersion: string | null
    }): ReleaseType | null {
        if (!fromVersion || !toVersion) return null
        try {
            return semverDiff(fromVersion, toVersion)
        } catch {
            return null
        }
    }

    async applyUpdates({
        config,
        rulesWithUpdates,
        workspace,
        report,
    }: {
        config: Config
        rulesWithUpdates: RulesWithUpdates
        workspace: Workspace
        report: Report
    }): Promise<Changeset> {
        const changeset: Changeset = new Map()
        const globToRule = new Map<RuleGlob, RuleConfig>(config.rules)

        let rulesAppliedCount = 0
        for (const [ruleGlob, updates] of rulesWithUpdates.entries()) {
            const rule = globToRule.get(ruleGlob)
            if (!rule) continue

            if (config.maxRulesApplied && rulesAppliedCount >= config.maxRulesApplied) {
                break
            }

            let ruleUpdateCount = 0
            for (const [identHash, descriptor] of updates.entries()) {
                if (rule.maxPackageUpdates && ruleUpdateCount >= rule.maxPackageUpdates) {
                    break
                }

                const stringifiedIdent = structUtils.stringifyIdent(
                    structUtils.convertToIdent(descriptor),
                )

                const oldBoundDescriptor = workspace.anchoredPackage.dependencies.get(identHash)
                if (!oldBoundDescriptor) continue

                const fromRange = structUtils.parseRange(oldBoundDescriptor.range).selector
                const toRange = structUtils.parseRange(descriptor.range).selector
                const fromVersion = this.getInstalledVersion({
                    descriptorHash: oldBoundDescriptor.descriptorHash,
                    project: workspace.project,
                })
                const toVersion = this.extractVersionFromRange(toRange)

                if (fromVersion === toVersion && config.skipManifestOnlyChanges) continue

                changeset.set(stringifiedIdent, {
                    fromRange,
                    toRange,
                    fromVersion,
                    toVersion,
                    updateType: this.getUpdateType({ fromVersion, toVersion }),
                })

                report.reportInfo(
                    MessageName.UNNAMED,
                    `[${ruleGlob}] ${stringifiedIdent}: ${fromRange} -> ${toRange}`,
                )

                for (const scopeKey of ['dependencies', 'devDependencies']) {
                    if (workspace.manifest.getForScope(scopeKey).has(identHash)) {
                        workspace.manifest.getForScope(scopeKey).set(identHash, descriptor)
                    }
                }

                if (!this.dryRun) {
                    workspace.project.forgetResolution(oldBoundDescriptor)
                }

                ruleUpdateCount += 1
            }

            if (ruleUpdateCount) rulesAppliedCount += 1
        }

        return changeset
    }

    async writeChangeset({ changeset }: { changeset: Changeset }): Promise<void> {
        if (!this.changesetFilename) return

        const changesetData: Record<
            string,
            {
                from_version: string | null
                from_range: string
                to_version: string
                to_range: string
                release_notes: string | null
                update_type: string | null
            }
        > = {}
        for (const [pkgName, record] of changeset.entries()) {
            changesetData[pkgName] = {
                from_version: record.fromVersion,
                from_range: record.fromRange,
                to_version: record.toVersion,
                to_range: record.toRange,
                update_type: record.updateType,
                release_notes: null,
            }
        }

        const jsonData = JSON.stringify(changesetData, null, 2)

        if (this.changesetFilename === '-') {
            this.context.stdout.write(jsonData)
        } else {
            const changesetPPath = ppath.resolve(
                ppath.cwd(),
                npath.toPortablePath(this.changesetFilename),
            )
            await xfs.writeFilePromise(changesetPPath, jsonData, {
                encoding: 'utf8',
            })
        }
    }
}

export { SemverUpCommand }
