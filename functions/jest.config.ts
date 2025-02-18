/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest/presets/default-esm', // Keep ESM preset as you are using modules
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'], // Keep all for now, can refine later
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest', // ONLY use ts-jest for .ts and .tsx files now
        '^.+\\.(js|jsx|mjs|cjs)$': 'babel-jest', // Keep babel-jest for other JS-like files if needed (less critical for now)
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1', // Keep ESM path mapping - might still be useful
    },
    roots: [
        "<rootDir>"
    ],
    testMatch: [
        '**/*.(test|spec).ts'      // IMPORTANT:  Now look for .ts test files
    ],
    testPathIgnorePatterns: [
        "<rootDir>/dist/",
        "<rootDir>/node_modules/"
    ],
};

export default config;