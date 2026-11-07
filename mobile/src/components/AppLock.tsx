import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { usePrefs } from '@/stores/prefs';
import { useAppTheme } from '@/theme/theme';

const RELOCK_AFTER_MS = 30_000;

/** Optional biometric app lock (§10). Locks on launch and after 30 s in the background. */
export function AppLock({ children }: { children: ReactNode }) {
  const enabled = usePrefs((s) => s.appLock) && Platform.OS !== 'web';
  // Starts locked when App Lock was on at launch; `locked` only matters while enabled.
  const [lockedRaw, setLocked] = useState(true);
  const locked = enabled && lockedRaw;
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);
  const theme = useAppTheme();

  const unlock = useCallback(() => {
    if (prompting.current) return;
    prompting.current = true;
    void LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock IDEA', fallbackLabel: 'Use passcode' })
      .then((res) => {
        if (res.success) setLocked(false);
      })
      .finally(() => {
        prompting.current = false;
      });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Prompt automatically whenever the lock screen appears.
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  return (
    <>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: theme.colors.background }]} accessibilityViewIsModal>
          <MaterialCommunityIcons name="lock-outline" size={48} color={theme.colors.primary} />
          <Text variant="titleLarge">IDEA is locked</Text>
          <Button mode="contained" icon="fingerprint" onPress={unlock}>
            Unlock
          </Button>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 },
});
