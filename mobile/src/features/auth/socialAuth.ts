import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { authApi } from '@/api/endpoints/auth';
import { connectionsApi } from '@/api/endpoints/platform';
import { buildUrl } from '@/api/client';
import type { AuthSession } from '@/api/types';
import { config } from '@/lib/config';
import { parseDeepLink } from '@/lib/deepLinks';

WebBrowser.maybeCompleteAuthSession();

export const oauthRedirect = () => Linking.createURL('oauth');

export function googleConfigured(): boolean {
  const ids = config.googleClientIds;
  if (Platform.OS === 'ios') return !!ids.ios;
  if (Platform.OS === 'android') return !!ids.android;
  return !!ids.web;
}

export class AuthCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'AuthCancelled';
  }
}

/** Sign in with Apple (§6.3). Raw nonce goes to our server; Apple gets its SHA-256. */
export async function signInWithApple(): Promise<AuthSession> {
  const rawNonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identity token.');
    const fullName = cred.fullName ? AppleAuthentication.formatFullName(cred.fullName) : undefined;
    return await authApi.apple({ identityToken: cred.identityToken, nonce: rawNonce, fullName: fullName || undefined });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthCancelled();
    throw e;
  }
}

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * GitHub sign-in via the native OAuth exchange (§6.2): open start in an auth
 * session, receive ideaplatform://oauth?code=…, exchange the one-time code.
 * The JWT never appears in a URL.
 */
export async function signInWithGitHub(): Promise<AuthSession> {
  const redirect = oauthRedirect();
  const result = await WebBrowser.openAuthSessionAsync(buildUrl(authApi.githubStartPath(redirect)), redirect);
  if (result.type !== 'success') throw new AuthCancelled();
  const link = parseDeepLink(result.url);
  if (link.kind !== 'oauth') throw new Error('Sign-in was not completed. Please try again.');
  return authApi.oauthExchange(link.code);
}

/** Provider connections (repo / deploy) use the same pattern; exchange returns a connectionId. */
export async function connectProvider(provider: string): Promise<string> {
  const redirect = oauthRedirect();
  const { url } = await connectionsApi.oauthStart(provider, redirect);
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== 'success') throw new AuthCancelled();
  const link = parseDeepLink(result.url);
  if (link.kind !== 'oauth') throw new Error('Connection was not completed.');
  const { connectionId } = await connectionsApi.exchange(link.code);
  return connectionId;
}
