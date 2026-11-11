import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Menu, Text, TouchableRipple } from 'react-native-paper';
import { TextInput } from '@/components/TextInput';

import { aiApi } from '@/api/endpoints/ai';
import { errorMessage } from '@/api/client';
import { OfflineBanner, useIsOffline } from '@/components/OfflineBanner';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { useTemplates } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useDraft } from '@/stores/draft';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

const FALLBACK_EXAMPLES = [
  'A habit tracker with streaks, reminders and a weekly progress chart',
  'A recipe app where I can save recipes, plan meals and make a shopping list',
  'A booking site for a small yoga studio with class schedules and sign-ups',
];

export default function IdeaStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { draft, update } = useDraft();
  const offline = useIsOffline();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const templates = useTemplates();
  const [menu, setMenu] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track('idea_started');
  }, []);

  const examples = (templates.data ?? []).map((tp) => tp.examplePrompt).filter((p): p is string => !!p).slice(0, 4);
  const shown = examples.length ? examples : FALLBACK_EXAMPLES;

  /** Camera / photos are requested only when tapped (§13.3). Android uses the system Photo Picker. */
  const pick = async (source: 'camera' | 'library') => {
    setMenu(false);
    setError(null);
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera access is off. You can enable it in system settings.');
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: false };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]?.base64) return;
    const asset = res.assets[0];
    const dataUrl = `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
    update({ designImage: dataUrl });
    if (!signedIn) return;
    setAnalyzing(true);
    try {
      const out = await aiApi.designToCode({ image: dataUrl, prompt: draft.prompt });
      update({ prompt: draft.prompt.trim() ? `${draft.prompt.trim()}\n\n${out.prompt}` : out.prompt, requirements: out.requirements ?? draft.requirements });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <BuilderScaffold
      step="idea"
      title={t('builder.ideaTitle')}
      nextDisabled={draft.prompt.trim().length < 10 || offline || analyzing}
      footerExtra={
        draft.prompt.trim().length > 0 && draft.prompt.trim().length < 10 ? (
          <HelperText type="info" visible>
            Add a little more detail (at least 10 characters).
          </HelperText>
        ) : null
      }
    >
      <OfflineBanner message={t('builder.offlineDraft')} />
      <TextInput
        mode="outlined"
        multiline
        value={draft.prompt}
        onChangeText={(prompt) => update({ prompt })}
        placeholder={t('builder.ideaPlaceholder')}
        style={styles.input}
        contentStyle={styles.inputContent}
        maxLength={4000}
        accessibilityLabel="Describe your idea"
        accessibilityHint="Use the microphone on your keyboard to dictate"
      />
      <View style={styles.row}>
        <Text variant="bodySmall" style={{ color: theme.colors.textMuted, flex: 1 }}>
          Tip: tap the mic on your keyboard to dictate.
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.textSubtle }}>
          {draft.prompt.length}/4000
        </Text>
      </View>

      <View style={styles.row}>
        <Menu
          visible={menu}
          onDismiss={() => setMenu(false)}
          anchor={
            <Button
              mode="outlined"
              icon="image-plus"
              textColor={theme.colors.onSurface}
              style={{ borderColor: theme.colors.border }}
              onPress={() => setMenu(true)}
              loading={analyzing}
              disabled={analyzing || !signedIn}
            >
              {t('builder.attach')}
            </Button>
          }
        >
          <Menu.Item leadingIcon="camera-outline" title="Take photo" onPress={() => pick('camera')} />
          <Menu.Item leadingIcon="image-outline" title="Choose from photos" onPress={() => pick('library')} />
        </Menu>
      </View>
      {draft.designImage ? (
        <View style={styles.attachment}>
          <Image source={{ uri: draft.designImage }} style={styles.thumb} accessibilityLabel="Attached design" />
          <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.textMuted }}>
            {analyzing ? 'Reading your design…' : 'Design attached. We’ll use it to shape the UI.'}
          </Text>
          <IconButton icon="close" onPress={() => update({ designImage: undefined })} accessibilityLabel="Remove attachment" />
        </View>
      ) : null}
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <View style={styles.examples}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="creation-outline" size={16} color={theme.colors.textMuted} />
          <Text variant="labelLarge" style={{ color: theme.colors.textMuted }}>
            {t('builder.examples')}
          </Text>
        </View>
        {/* Full-width rows that wrap, so whole example prompts are readable (chips truncated them). */}
        {shown.map((ex) => (
          <TouchableRipple
            key={ex}
            onPress={() => update({ prompt: ex })}
            style={[styles.example, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            borderless
            accessibilityRole="button"
            accessibilityLabel={`Use example: ${ex}`}
          >
            <View style={styles.exampleInner}>
              <Text variant="bodyMedium" style={styles.flex}>
                {ex}
              </Text>
              <MaterialCommunityIcons name="arrow-top-left" size={18} color={theme.colors.textMuted} />
            </View>
          </TouchableRipple>
        ))}
      </View>
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 160 },
  inputContent: { paddingTop: 12, minHeight: 160, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  examples: { gap: 8 },
  example: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  exampleInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  flex: { flex: 1 },
});
