import path from 'path'

import HtmlWebpackPlugin from 'html-webpack-plugin'
import webpack from 'webpack'

const PLUGIN_NAME = 'InjectInlineHtmlWebpackPlugin'
const SCRIPT_EXTS = new Set<string>(['.js', '.cjs', '.mjs'])

declare module 'html-webpack-plugin' {
    class HtmlWebpackPlugin {
        public options?: HtmlWebpackPlugin.Options & {
            inlineScripts?: string[]
        }
    }
}

export interface InjectInlineHtmlWebpackPluginOptions {
    runtimeChunkName?: string
    chunkPrefix?: string
}

/**
 * This plugin will inject raw scripts into the head of the
 * generated HTML file from HtmlWebpackPlugin.
 *
 * ```
 * new HtmlWebpackPlugin({
 *   inlineScripts: ['my-script.js'],
 * }),
 * new InjectInlineHtmlWebpackPlugin()
 * ```
 */
class InjectInlineHtmlWebpackPlugin {
    private scripts: string[]
    private options: InjectInlineHtmlWebpackPluginOptions

    constructor(options?: InjectInlineHtmlWebpackPluginOptions) {
        this.options = options ?? {}
        this.scripts = []
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.beforeRun.tapAsync(PLUGIN_NAME, this.tapBeforeRun.bind(this))
        compiler.hooks.watchRun.tapAsync(PLUGIN_NAME, this.tapBeforeRun.bind(this))
        compiler.hooks.compilation.tap(PLUGIN_NAME, this.tapCompilation.bind(this))
    }

    getScriptKeyName(script: string): string {
        const prefix = this.options.chunkPrefix ?? 'inject_inline'
        return `${prefix}-${this.scripts.findIndex((s) => s === script)}i`
    }

    tapBeforeRun(
        compiler: webpack.Compiler,
        done: (error?: Error | null | false, result?: void) => void,
    ): void {
        // parse set of inline scripts from the html webpack configs
        const inlineScripts = compiler.options.plugins
            ?.filter((plugin) => plugin instanceof HtmlWebpackPlugin)
            .map(
                (plugin) =>
                    (plugin as HtmlWebpackPlugin.HtmlWebpackPlugin).options?.inlineScripts ?? [],
            )
            .flat() as string[]

        this.scripts.push(...new Set(inlineScripts ?? []))

        for (const script of this.scripts) {
            new webpack.EntryPlugin(process.cwd(), script, this.getScriptKeyName(script)).apply(
                compiler,
            )
        }
        done()
    }

    tapCompilation(compilation: webpack.Compilation): void {
        const hooks = HtmlWebpackPlugin.getHooks(compilation)
        hooks.alterAssetTagGroups.tapAsync(PLUGIN_NAME, (data, done) => {
            const inlineScripts = [...(data.plugin.options?.inlineScripts ?? [])]
            this.inlineRuntime(compilation, data)
            Promise.all(
                inlineScripts.map(async (inlineScript) => {
                    const assetKey = this.findCompilationAssetName(
                        compilation,
                        this.getScriptKeyName(inlineScript),
                    )
                    if (assetKey && compilation.assets[assetKey]) {
                        const sourceCode = compilation.assets[assetKey].source()

                        // insert before all other scripts
                        const injectOffset =
                            (data.headTags.findIndex(
                                (tag) =>
                                    tag.tagName === 'script' && tag.meta?.plugin !== PLUGIN_NAME,
                            ) + 1 || data.headTags.length + 1) - 1

                        data.headTags.splice(
                            injectOffset,
                            0,
                            this.createInlineScriptTag(String(sourceCode)),
                        )
                    }
                }),
            ).then(() => {
                done(null, data)
            })
        })
    }

    findCompilationAssetName(compilation: webpack.Compilation, prefix: string): string | undefined {
        // We're only interested in scripts and not LICENSES or source maps.
        return Object.keys(compilation.assets).find(
            (assetName) => SCRIPT_EXTS.has(path.extname(assetName)) && assetName.startsWith(prefix),
        )
    }

    createInlineScriptTag(source: string): HtmlWebpackPlugin.HtmlTagObject {
        return {
            tagName: 'script',
            /**
             * The !function syntax ensures this script is separated by an implicit semicolon
             * from any earlier script modules, whereas (function(){})() might be considered a
             * function invocation of a function defined in an earlier script.
             *
             * The newline before the closing brace is to support the // sourceMapUrl comment.
             */
            innerHTML: `\n!function(){${source.trim()}\n}();\n`,
            voidTag: false,
            attributes: {
                'data-inline-chunk': true,
            },
            meta: {
                plugin: PLUGIN_NAME,
            },
        }
    }

    inlineRuntime(
        compilation: webpack.Compilation,
        data: {
            bodyTags: HtmlWebpackPlugin.HtmlTagObject[]
            headTags: HtmlWebpackPlugin.HtmlTagObject[]
            outputName: string
            plugin: HtmlWebpackPlugin.HtmlWebpackPlugin
        },
    ): void {
        const runtimeChunkName = this.options.runtimeChunkName ?? 'runtime'
        const runtimeFilename = this.findCompilationAssetName(compilation, runtimeChunkName)

        if (!runtimeFilename) return

        const asset = compilation.assets[runtimeFilename]
        if (!asset) return

        const withoutRuntimeFilter = (tag: HtmlWebpackPlugin.HtmlTagObject) =>
            !(tag?.attributes?.src as string | undefined)?.endsWith(runtimeFilename)

        data.headTags = data.headTags.filter(withoutRuntimeFilter)
        data.bodyTags = data.bodyTags.filter(withoutRuntimeFilter)

        const runtimeTag = this.createInlineScriptTag(String(asset.source()))

        // insert before all other scripts
        const offset =
            (data.headTags.findIndex((tag) => tag.tagName === 'script') + 1 ||
                data.headTags.length + 1) - 1
        data.headTags.splice(offset, 0, runtimeTag)
    }
}

export default InjectInlineHtmlWebpackPlugin
