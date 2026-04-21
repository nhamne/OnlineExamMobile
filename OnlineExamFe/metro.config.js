const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude large or unnecessary files from being indexed
config.resolver.blockList = [
  /.*\.js\.map$/,
  /debug_bundle.*/,
  /repair\.js/,
];

module.exports = withNativeWind(config, { input: './global.css' });
