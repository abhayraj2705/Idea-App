import { List, RadioButton } from 'react-native-paper';

import { Screen } from '@/components/Screen';
import { usePrefs, type ThemeMode } from '@/stores/prefs';

const OPTIONS: { value: ThemeMode; title: string; icon: string }[] = [
  { value: 'system', title: 'Match system', icon: 'theme-light-dark' },
  { value: 'light', title: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', title: 'Dark', icon: 'weather-night' },
];

export default function Appearance() {
  const mode = usePrefs((s) => s.themeMode);
  const set = usePrefs((s) => s.set);
  return (
    <Screen padded={false}>
      <RadioButton.Group value={mode} onValueChange={(v) => set({ themeMode: v as ThemeMode })}>
        {OPTIONS.map((o) => (
          <List.Item
            key={o.value}
            title={o.title}
            left={(p) => <List.Icon {...p} icon={o.icon} />}
            right={() => <RadioButton value={o.value} />}
            onPress={() => set({ themeMode: o.value })}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === o.value }}
          />
        ))}
      </RadioButton.Group>
    </Screen>
  );
}
