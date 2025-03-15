/** @type {import('jest').Config} */
const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    testMatch: [
        '**/*.(test|spec).ts'
    ],
    testPathIgnorePatterns: [
        "<rootDir>/dist/",
        "<rootDir>/node_modules/"
    ]
};
module.exports = config;
//# sourceMappingURL=jest.config.js.map