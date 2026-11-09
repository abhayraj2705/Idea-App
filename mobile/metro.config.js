// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @sentry/react-native optionally requires an internal expo-router module
// (`expo-router/build/global-state/router-store`) inside a try/catch. That
// module no longer exists in expo-router 58, so Metro prints an
// "invalid package.json configuration" warning on every bundle. Resolve it to
// an empty module: Sentry then sees no store and falls back exactly as it does
// today, minus the warning noise.
const SENTRY_OPTIONAL_EXPO_ROUTER_STORE = 'expo-router/build/global-state/router-store';

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === SENTRY_OPTIONAL_EXPO_ROUTER_STORE) {
    return { type: 'empty' };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
