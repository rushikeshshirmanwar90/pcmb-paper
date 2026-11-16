const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-worklets publishes only compiled output (lib/module/) but its
// package.json has "react-native": "./src/index" which points to source files
// that are NOT included in the npm package. We redirect only that one package
// to its compiled entry — leaving all other packages (safe-area-context etc.)
// to resolve via the normal "react-native" field so their native specs work.
const workletsDir = path.resolve(__dirname, 'node_modules/react-native-worklets');
const workletsEntry = path.resolve(workletsDir, 'lib/module/index.js');

const defaultResolver = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-worklets') {
    return { type: 'sourceFile', filePath: workletsEntry };
  }
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
