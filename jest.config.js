// @ts-check

const CI = Boolean(process.env.CI)

/** @type {import('@swc/core').Config} */
const swcOptions = {
    jsc: {
        parser: { syntax: 'typescript' },
    },
}

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
    ...(CI && {
        reporters: [
            'default',
            [
                'jest-junit',
                {
                    suiteName: 'Jest Tests',
                    outputDirectory: 'reports/jest/',
                    outputName: 'jest.junit.xml',
                },
            ],
        ],
        collectCoverage: true,
        coverageProvider: 'v8',
    }),
    transform: {
        // @ts-expect-error jest types are not correct here
        '^.+\\.[cm]?[tj]s$': [require.resolve('@swc/jest'), swcOptions],
    },
    moduleNameMapper: {
        '^((\\.{1,2}/?)+.*)\\.[mc]?js$': '$1',
    },
    testMatch: ['<rootDir>/packages/**/*.test.{cts,mts,ts}'],
    extensionsToTreatAsEsm: ['.mts'],
    coverageReporters: CI ? ['json'] : ['text', 'json'],
    coverageDirectory: 'raw-coverage/jest/',
    collectCoverageFrom: [
        'packages/**/src/**/*.{ts,mts}',
        '.yarn/__virtual__/**/packages/**/*.{cts,ts,mts}',
    ],
    coveragePathIgnorePatterns: ['/node_modules/', '/__mocks__/', '\\.test.m?ts$', '\\.mock.m?ts$'],
    watchPathIgnorePatterns: ['<rootDir>/packages/.*/lib', '<rootDir>/packages/.*/.*\\.m?js$'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/.yarn/',
        '<rootDir>/.*\\.m?js',
        '<rootDir>/.*/lib/',
    ],
    haste: {
        throwOnModuleCollision: true,
    },
    modulePathIgnorePatterns: ['<rootDir>/.*/lib'],
    testTimeout: 30000,
}

module.exports = config
