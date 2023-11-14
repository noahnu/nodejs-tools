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
        '^.+\\.tsx?$': require.resolve('ts-jest'),
    },
    setupFiles: ['<rootDir>/testUtils/setup.ts'],
    coverageReporters: CI ? ['json'] : ['text', 'json'],
    coverageDirectory: 'raw-coverage/jest/',
    collectCoverageFrom: ['packages/**/src/**/*.ts', '.yarn/__virtual__/**/packages/**/*.ts'],
    coveragePathIgnorePatterns: ['/node_modules/', '/__mocks__/', '\\.test.ts$', '\\.mock.ts$'],
    watchPathIgnorePatterns: [
        '<rootDir>/example-monorepo',
        '<rootDir>/artifacts',
        '<rootDir>/packages/.*/lib',
        '<rootDir>/packages/.*/.*\\.js',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/.yarn/',
        '<rootDir>/.*\\.js',
        '<rootDir>/.*/lib/',
        '<rootDir>/packages',
    ],
    haste: {
        throwOnModuleCollision: true,
    },
    modulePathIgnorePatterns: ['<rootDir>/.*/lib'],
    testTimeout: 30000,
    resolver: require.resolve('@tophat/jest-resolver'),
}

module.exports = config
