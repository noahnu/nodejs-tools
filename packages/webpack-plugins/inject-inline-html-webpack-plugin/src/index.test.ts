import { describe, expect, it } from '@jest/globals'

import InjectInlineHtmlWebpackPlugin from '.'

describe('Plugin Test', () => {
    it('exports the plugin', () => {
        expect(() => {
            new InjectInlineHtmlWebpackPlugin()
        }).not.toThrow()
    })
})
