/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['.history'],
  transformIgnorePatterns: ['/node_modules/(?!(ansi-regex)/)'],
}
