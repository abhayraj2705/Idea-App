import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Environment-aware Expo config (MOBILE_APP_MASTER_PLAN.md §4).
 *
 * APP_ENV selects development | staging | production. The three variants
 * install side by side (different bundle id / package / scheme / name).
 * Secrets never live here: Google client ids are public identifiers and
 * everything else is resolved server-side or via EAS secrets.
 */
type AppEnv = 'development' | 'staging' | 'production';

const APP_ENV = (process.env.APP_ENV as AppEnv) || 'development';
const IS_DEV = APP_ENV === 'development';

const VERSION = '1.0.0';
const WEB_DOMAIN = process.env.WEB_DOMAIN || 'ideaplatform.app';

const variants: Record<AppEnv, { name: string; id: string; scheme: string; apiUrl: string }> = {
  development: {
    name: 'IDEA (Dev)',
    id: 'com.ideaplatform.app.dev',
    scheme: 'ideaplatform-dev',
    // Android emulator reaches the host's localhost at 10.0.2.2 (§4).
    apiUrl: process.env.API_URL || 'http://10.0.2.2:5000',
  },
  staging: {
    name: 'IDEA (Staging)',
    id: 'com.ideaplatform.app.staging',
    scheme: 'ideaplatform-staging',
    apiUrl: process.env.API_URL || `https://staging-api.${WEB_DOMAIN}`,
  },
  production: {
    name: 'IDEA',
    id: 'com.ideaplatform.app',
    scheme: 'ideaplatform',
    apiUrl: process.env.API_URL || `https://api.${WEB_DOMAIN}`,
  },
};

const v = variants[APP_ENV];

// Release builds must talk to a real HTTPS backend: Android blocks cleartext
// traffic in release, and a localhost/emulator URL would ship a broken app.
if (!IS_DEV) {
  const url = new URL(v.apiUrl);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname)) {
    throw new Error(`[app.config] ${APP_ENV} build needs an HTTPS API URL, got "${v.apiUrl}". Set API_URL or WEB_DOMAIN.`);
  }
}

const plugins: ExpoConfig['plugins'] = [
  'expo-router',
  'expo-secure-store',
  'expo-web-browser',
  'expo-localization',
  'expo-sharing',
  'expo-font',
  'expo-apple-authentication',
  [
    'expo-splash-screen',
    {
      image: './assets/splash-icon.png',
      imageWidth: 180,
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF',
      dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#0A0A0A' },
    },
  ],
  [
    'expo-notifications',
    {
      icon: './assets/notification-icon.png',
      color: '#F97316',
      defaultChannel: 'default',
    },
  ],
  [
    // Camera / photos only for design-to-code, requested on tap (§13.3).
    // Android uses the system Photo Picker, which needs no storage permission.
    'expo-image-picker',
    {
      photosPermission: 'IDEA uses your photos so you can turn a screenshot or sketch into an app design.',
      cameraPermission: 'IDEA uses the camera so you can photograph a sketch and turn it into an app design.',
      microphonePermission: false,
    },
  ],
  [
    'expo-local-authentication',
    { faceIDPermission: 'IDEA uses Face ID to unlock the app when you turn on App Lock.' },
  ],
  [
    'expo-build-properties',
    {
      android: {
        // TLS only outside development (§10).
        usesCleartextTraffic: IS_DEV,
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    },
  ],
];

if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  plugins.push([
    '@sentry/react-native/expo',
    { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
  ]);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: v.name,
  slug: 'idea-platform',
  owner: process.env.EXPO_OWNER,
  version: VERSION,
  scheme: v.scheme,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'fingerprint' },
  updates: process.env.EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` }
    : undefined,
  ios: {
    bundleIdentifier: v.id,
    supportsTablet: true,
    deploymentTarget: '16.4',
    usesAppleSignIn: true,
    associatedDomains: [`applinks:${WEB_DOMAIN}`],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: v.id,
    adaptiveIcon: {
      backgroundColor: '#0A0A0A',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Google Play: request only what the product needs. These are pulled in
    // transitively by some modules but are not used by IDEA, and several are
    // restricted permissions that trigger extra Play review.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: WEB_DOMAIN, pathPrefix: '/verify-email' },
          { scheme: 'https', host: WEB_DOMAIN, pathPrefix: '/reset-password' },
          { scheme: 'https', host: WEB_DOMAIN, pathPrefix: '/team/accept' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
    bundler: 'metro',
  },
  plugins,
  experiments: { typedRoutes: false },
  extra: {
    appEnv: APP_ENV,
    apiUrl: v.apiUrl,
    webUrl: `https://${WEB_DOMAIN}`,
    supportEmail: process.env.SUPPORT_EMAIL || `support@${WEB_DOMAIN}`,
    sentryDsn: process.env.SENTRY_DSN || '',
    googleClientIds: {
      ios: process.env.GOOGLE_IOS_CLIENT_ID || '',
      android: process.env.GOOGLE_ANDROID_CLIENT_ID || '',
      web: process.env.GOOGLE_WEB_CLIENT_ID || '',
    },
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
