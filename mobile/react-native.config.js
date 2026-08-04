/**
 * React Native CLI configuration.
 *
 * Autolinking scans dependencies for native modules. In a workspace the
 * packages are hoisted to the repository root, so the CLI is pointed there
 * explicitly — otherwise a native dependency added later would install but
 * never link.
 */
const path = require('node:path');

module.exports = {
  dependencies: {},
  reactNativePath: path.resolve(__dirname, '..', 'node_modules', 'react-native'),
};
