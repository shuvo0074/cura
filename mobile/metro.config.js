const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration — npm-workspaces aware.
 *
 * The default config assumes a self-contained app directory. In this monorepo
 * two things differ:
 *
 *  - `@cura/shared` lives outside `mobile/`, so Metro must watch the workspace
 *    root or edits to shared ViewModels never trigger a reload.
 *  - Most dependencies are hoisted to the root `node_modules`, so resolution
 *    has to look there as well as in `mobile/node_modules`.
 *
 * Hierarchical lookup is deliberately left ON. Locking resolution to the two
 * roots above (`disableHierarchicalLookup: true`) looks tidier but breaks the
 * build: npm nests packages it cannot hoist — `@react-native/normalize-colors`
 * ends up under `react-native/node_modules` — and Metro must be able to walk up
 * from the importing file to find them.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
