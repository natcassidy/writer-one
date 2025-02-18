/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx|mjs|cjs)$': 'babel-jest', // Keep for other JS files if needed
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    roots: [
        "<rootDir>"
    ],
    testMatch: [
        '**/*.(test|spec).ts'
    ],
    testPathIgnorePatterns: [
        "<rootDir>/dist/",
        "<rootDir>/node_modules/"
    ],
    // transformIgnorePatterns: [ // You might be able to REMOVE this line now
    //     '/node_modules/(?!chai)/',
    // ],
};

export default config;