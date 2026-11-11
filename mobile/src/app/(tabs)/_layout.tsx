import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/theme';
import { font } from '@/theme/fonts';
import { headerOptions } from '@/theme/navigation';

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        ...headerOptions(theme),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        // Sized explicitly: the default 48-49pt bar left the label ~7pt under the icon, clipping it.
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          height: 64 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        // Cap scaling on the 5-up tab bar: at 200% system text the labels otherwise clip. Content screens scale fully.
        tabBarLabel: ({ color, children }) => (
          <Text style={[styles.tabLabel, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarIcon: ({ color, focused, size }) => <MaterialCommunityIcons name={focused ? 'home' : 'home-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t('tabs.projects'),
          tabBarIcon: ({ color, focused, size }) => (
            <MaterialCommunityIcons name={focused ? 'folder-multiple' : 'folder-multiple-outline'} color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: t('tabs.new'),
          tabBarAccessibilityLabel: 'Start a new app',
          tabBarButton: (props) => (
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push('/builder/idea');
              }}
              style={styles.newWrap}
              accessibilityRole="button"
              accessibilityLabel="Start a new app"
              testID={props.testID}
            >
              <View style={[styles.newBtn, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="plus" size={22} color={theme.colors.onPrimary} />
              </View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t('tabs.activity'),
          tabBarIcon: ({ color, focused, size }) => <MaterialCommunityIcons name={focused ? 'bell' : 'bell-outline'} color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused, size }) => (
            <MaterialCommunityIcons name={focused ? 'account-circle' : 'account-circle-outline'} color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, lineHeight: 15, fontFamily: font.semibold, flexShrink: 0 },
  newWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  // Flat and in line with the other tabs: the create action is distinct by colour, not by floating above the bar.
  newBtn: { width: 48, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
