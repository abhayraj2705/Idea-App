import * as Application from 'expo-application';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Extra = {
  appEnv: 'development' | 'staging' | 'production';
  apiUrl: string;
  webUrl: string;
  supportEmail: string;
  sentryDsn: string;
  googleClientIds: { ios: string; android: string; web: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;
const inExpoGo = isRunningInExpoGo();

/**
 * The backend base URL comes from app.config.ts (per APP_ENV), which refuses to
 * build staging/production against anything but HTTPS. EXPO_PUBLIC_API_URL is a
 * local-development convenience (e.g. a LAN IP for a physical device) and is
 * ignored outside development so a stray env var can't redirect a release build.
 */
function resolveApiUrl(): string {
  const env = extra.appEnv ?? 'development';
  const override = env === 'development' ? process.env.EXPO_PUBLIC_API_URL : undefined;
  const url = override || extra.apiUrl || (env === 'development' ? 'http://10.0.2.2:5000' : '');
  if (!url) throw new Error(`No API URL configured for ${env}. Set API_URL or WEB_DOMAIN when building.`);
  return url.replace(/\/$/, '');
}

export const config = {
  appEnv: extra.appEnv ?? 'development',
  apiUrl: resolveApiUrl(),
  webUrl: extra.webUrl ?? 'https://ideaplatform.app',
  supportEmail: extra.supportEmail ?? 'support@ideaplatform.app',
  sentryDsn: extra.sentryDsn ?? '',
  googleClientIds: extra.googleClientIds ?? { ios: '', android: '', web: '' },
  scheme: (Constants.expoConfig?.scheme as string | undefined) ?? 'ideaplatform',
  // Inside Expo Go the native version is Expo Go's own (e.g. 58.0.5), not ours.
  appVersion: (inExpoGo ? null : Application.nativeApplicationVersion) ?? Constants.expoConfig?.version ?? '1.0.0',
  buildNumber: (inExpoGo ? 'dev' : Application.nativeBuildVersion) ?? '0',
  platform: Platform.OS as 'ios' | 'android' | 'web',
};

/** X-Client header (§8.3). Never includes user identifiers. */
export const clientHeader = `ideaplatform-mobile/${config.appVersion} (${config.platform})`;

export const legalUrls = {
  privacy: `${config.webUrl}/privacy`,
  terms: `${config.webUrl}/terms`,
  deleteAccount: `${config.webUrl}/account/delete`,
  support: `${config.webUrl}/support`,
};
