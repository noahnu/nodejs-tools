// @ts-check

const CI = Boolean(process.env.CI)

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
    }),
    transform: {
        '^.+\\.ts$': require.resolve('ts-jest'),
    },
    coverageReporters: CI ? ['json'] : ['text', 'json'],
    coverageDirectory: 'raw-coverage/jest/',
    collectCoverageFrom: ['packages/**/src/**/*.ts', '.yarn/__virtual__/**/packages/**/*.ts'],
    coveragePathIgnorePatterns: ['/node_modules/', '/__mocks__/', '\\.test.ts$', '\\.mock.ts$'],
    watchPathIgnorePatterns: ['<rootDir>/packages/.*/lib', '<rootDir>/packages/.*/.*\\.js'],
    testPathIgnorePatterns: ['/node_modules/', '/.yarn/', '<rootDir>/.*\\.js', '<rootDir>/.*/lib/'],
    haste: {
        throwOnModuleCollision: true,
    },
    modulePathIgnorePatterns: ['<rootDir>/.*/lib'],
    testTimeout: 30000,
}

module.exports = config
