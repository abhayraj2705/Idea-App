import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Banner, Button, Card, Dialog, IconButton, Portal, SegmentedButtons, Text } from 'react-native-paper';
import { QRCode } from '@/components/QRCode';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import type { ComponentType, Ref } from 'react';

import { mobileBuildApi, previewApi } from '@/api/endpoints/platform';
import { errorMessage } from '@/api/client';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { isAllowedUrl, previewOrigins } from '@/features/preview/origins';
import { useProject, useProjectSdk } from '@/features/queries';
import { track } from '@/lib/analytics';
import { useAppTheme } from '@/theme/theme';

type WebViewHandle = { reload: () => void };
// react-native-webview declares `WebView<P = undefined>`, so its props become `X & undefined`
// (= never) under TS 6 strict. Re-type it once here with the real props.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

type Device = 'phone' | 'tablet' | 'desktop';
const DEVICE_WIDTH: Record<Device, number> = { phone: 390, tablet: 820, desktop: 1280 };

function SafeWebView({ url, device }: { url: string; device: Device }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const ref = useRef<WebViewHandle>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [boxHeight, setBoxHeight] = useState(600);
  const origins = useMemo(() => previewOrigins(url), [url]);
  const virtualWidth = Math.max(width, DEVICE_WIDTH[device]);
  const scale = width / virtualWidth;

  if (Platform.OS === 'web') {
    return (
      <EmptyView icon="open-in-new" title="Open the preview in your browser" action={<Button mode="contained" onPress={() => WebBrowser.openBrowserAsync(url)}>Open preview</Button>} />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.surfaceVariant }]}>
      <View style={styles.webToolbar}>
        <IconButton icon="refresh" onPress={() => ref.current?.reload()} accessibilityLabel="Reload preview" />
        <Text variant="labelSmall" numberOfLines={1} style={[styles.flex, { color: theme.colors.textMuted }]}>
          {url.replace(/\?.*$/, '')}
        </Text>
        <IconButton icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(url)} accessibilityLabel="Open in browser" />
      </View>
      {failed ? (
        <ErrorView error={new Error(failed)} onRetry={() => { setFailed(null); ref.current?.reload(); }} />
      ) : (
        <View style={[styles.flex, styles.clip]} onLayout={(e) => setBoxHeight(e.nativeEvent.layout.height)}>
          {/* Device-size toggle via viewport scaling: render at the virtual width, scale down to fit. */}
          <View style={{ width: virtualWidth, height: boxHeight / scale, transform: [{ scale }], transformOrigin: 'top left' }}>
            <WebView
              ref={ref}
              source={{ uri: url }}
              style={styles.flex}
              originWhitelist={origins}
              onShouldStartLoadWithRequest={(req) => {
                if (isAllowedUrl(req.url, origins)) return true;
                if (/^https?:/i.test(req.url)) void WebBrowser.openBrowserAsync(req.url);
                return false;
              }}
              javaScriptCanOpenWindowsAutomatically={false}
              setSupportMultipleWindows={false}
              allowsBackForwardNavigationGestures
              pullToRefreshEnabled
              allowFileAccess={false}
              allowUniversalAccessFromFileURLs={false}
              mixedContentMode="never"
              incognito
              onError={(e) => setFailed(e.nativeEvent.description || 'The preview failed to load.')}
              onHttpError={(e) => {
                if (e.nativeEvent.statusCode >= 500) setFailed(`The preview server returned ${e.nativeEvent.statusCode}.`);
              }}
              startInLoadingState
            />
          </View>
        </View>
      )}
    </View>
  );
}

function WebPreview({ projectId, notReadyReasons }: { projectId: string; notReadyReasons?: string[] }) {
  const [device, setDevice] = useState<Device>('phone');
  const session = useQuery({ queryKey: ['preview-session', projectId], queryFn: () => previewApi.sessionToken(projectId), staleTime: 4 * 60_000 });

  useEffect(() => {
    track('preview_opened', { kind: 'web' });
  }, []);

  if (notReadyReasons?.length) {
    return (
      <Screen>
        <EmptyView icon="eye-off-outline" title="The preview isn’t ready yet" />
        {notReadyReasons.map((r) => (
          <Text key={r} variant="bodyMedium">
            • {r}
          </Text>
        ))}
      </Screen>
    );
  }
  if (session.isLoading) return <LoadingView label="Starting preview…" />;
  if (session.isError) return <ErrorView error={session.error} onRetry={() => session.refetch()} />;

  return (
    <View style={styles.flex}>
      <View style={styles.devices}>
        <SegmentedButtons
          density="small"
          value={device}
          onValueChange={(v) => setDevice(v as Device)}
          buttons={[
            { value: 'phone', icon: 'cellphone', label: 'Phone' },
            { value: 'tablet', icon: 'tablet', label: 'Tablet' },
            { value: 'desktop', icon: 'monitor', label: 'Desktop' },
          ]}
        />
      </View>
      <SafeWebView url={session.data!.url} device={device} />
    </View>
  );
}

function MobilePreview({ projectId }: { projectId: string }) {
  const theme = useAppTheme();
  const [qr, setQr] = useState(false);
  const [webLook, setWebLook] = useState(false);
  const [snackConsent, setSnackConsent] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const preview = useQuery({ queryKey: ['mobile-preview', projectId], queryFn: () => previewApi.createMobilePreview(projectId), staleTime: 5 * 60_000 });
  const sdk = useProjectSdk(projectId);

  useEffect(() => {
    track('preview_opened', { kind: 'mobile' });
  }, []);

  if (preview.isLoading) return <LoadingView label="Preparing your app…" />;
  if (preview.isError) return <ErrorView error={preview.error} onRetry={() => preview.refetch()} />;
  const p = preview.data!;
  const expoUrl = p.expoGoUrl ?? p.manifestUrl;

  const openExpoGo = async () => {
    if (!expoUrl) return;
    try {
      await Linking.openURL(expoUrl);
    } catch {
      // Expo Go not installed → store listing
      await Linking.openURL(
        Platform.OS === 'ios' ? 'https://apps.apple.com/app/expo-go/id982107779' : 'https://play.google.com/store/apps/details?id=host.exp.exponent',
      );
    }
  };

  if (webLook && p.webUrl) {
    return (
      <View style={styles.flex}>
        <Button icon="arrow-left" onPress={() => setWebLook(false)} style={styles.back}>
          Back to options
        </Button>
        <SafeWebView url={p.webUrl} device="phone" />
      </View>
    );
  }

  return (
    <Screen>
      {sdk.data?.upgradeAvailable ? (
        <Banner
          visible
          icon="update"
          actions={[
            {
              label: 'Upgrade SDK',
              onPress: async () => {
                try {
                  await mobileBuildApi.upgradeSdk(projectId);
                  setUpgradeMsg('SDK upgrade started. We’ll refresh the preview when it’s done.');
                  void sdk.refetch();
                } catch (e) {
                  setUpgradeMsg(errorMessage(e));
                }
              },
            },
          ]}
        >
          This app uses Expo SDK {sdk.data.current}. SDK {sdk.data.latest} is available.
        </Banner>
      ) : null}
      {upgradeMsg ? <Text variant="bodySmall">{upgradeMsg}</Text> : null}

      <Card mode="contained">
        <Card.Title title="Run it on this phone" subtitle="Opens directly in Expo Go — no QR code needed." left={(pp) => <IconButton {...pp} icon="cellphone-play" />} />
        <Card.Actions>
          <Button mode="contained" icon="play" disabled={!expoUrl} onPress={() => (p.engine === 'snack' ? setSnackConsent(true) : openExpoGo())}>
            Open in Expo Go
          </Button>
        </Card.Actions>
      </Card>
      <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
        <Card.Title title="Preview on another device" left={(pp) => <IconButton {...pp} icon="qrcode" />} />
        <Card.Actions>
          <Button icon="qrcode-scan" disabled={!expoUrl} onPress={() => setQr(true)}>
            Show QR code
          </Button>
        </Card.Actions>
      </Card>
      {p.webUrl ? (
        <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
          <Card.Title title="Quick look" subtitle="The web build, right here." left={(pp) => <IconButton {...pp} icon="web" />} />
          <Card.Actions>
            <Button icon="eye-outline" onPress={() => setWebLook(true)}>
              Open web build
            </Button>
          </Card.Actions>
        </Card>
      ) : null}

      <Portal>
        <Dialog visible={qr} onDismiss={() => setQr(false)}>
          <Dialog.Title>Scan with Expo Go</Dialog.Title>
          <Dialog.Content style={styles.qr}>
            {expoUrl ? (
              <View style={[styles.qrBox, { backgroundColor: theme.colors.surface }]}>
                <QRCode value={expoUrl} size={220} color={theme.colors.onSurface} backgroundColor={theme.colors.surface} />
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQr(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
        {/* Parity with web ExpoSnackPreview.tsx: explicit consent before sending code to Expo. */}
        <Dialog visible={snackConsent} onDismiss={() => setSnackConsent(false)}>
          <Dialog.Title>Send your code to Expo?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This project uses an older SDK, so the preview runs on Expo Snack. Your project’s code will be uploaded to Expo’s servers to run it.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSnackConsent(false)}>Cancel</Button>
            <Button
              onPress={() => {
                setSnackConsent(false);
                void openExpoGo();
              }}
            >
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useProject(id);
  if (project.isLoading) return <LoadingView />;
  if (project.isError && !project.data) return <ErrorView error={project.error} onRetry={() => project.refetch()} />;
  const p = project.data!;
  if (p.kind === 'mobile') return <MobilePreview projectId={id} />;
  return <WebPreview projectId={id} notReadyReasons={p.previewReadiness && !p.previewReadiness.ready ? p.previewReadiness.reasons ?? ['Still building'] : undefined} />;
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  devices: { paddingHorizontal: 12, paddingVertical: 8 },
  webToolbar: { flexDirection: 'row', alignItems: 'center' },
  clip: { overflow: 'hidden' },
  back: { alignSelf: 'flex-start', margin: 4 },
  qr: { alignItems: 'center' },
  qrBox: { padding: 16, borderRadius: 12 },
});
