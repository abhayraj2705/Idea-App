import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/theme';
import { font } from '@/theme/fonts';

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { color: theme.colors.onSurface },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
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
          tabBarAccessibilityLabel: 'New idea',
          tabBarButton: (props) => (
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push('/builder/idea');
              }}
              style={styles.newWrap}
              accessibilityRole="button"
              accessibilityLabel="New idea"
              testID={props.testID}
            >
              <View style={[styles.newBtn, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="plus" size={28} color={theme.colors.onPrimary} />
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
  tabLabel: { fontSize: 11, fontFamily: font.semibold },
  newWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  newBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
