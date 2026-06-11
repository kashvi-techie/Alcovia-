const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// COMPLETELY DISABLE node:sea EXTERNAL SHIMS FOR WINDOWS
// This blocks all node: protocol modules that cause Windows colon character issues

// Ensure blockList is an array before spreading
const existingBlockList = Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [];

config.resolver.blockList = [
  ...existingBlockList,
  // Block ALL node: protocol imports completely
  /^node:sea$/,
  /^node:sea\/.*$/,
  /^node:.*$/,
];

// Override resolver to completely exclude node:sea and all node: modules
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Completely block and ignore ALL node: protocol modules
  if (moduleName.startsWith('node:')) {
    console.warn(`[Metro] Blocking node: protocol module: ${moduleName} (Windows compatibility)`);
    return {
      filePath: require.resolve('expo/empty-module'),
    };
  }
  
  // Use original resolver for all other modules
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  
  // Fallback to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

// Ensure asset extensions are properly handled
config.resolver.assetExts = config.resolver.assetExts || [];
config.resolver.sourceExts = config.resolver.sourceExts || [];

module.exports = config;
