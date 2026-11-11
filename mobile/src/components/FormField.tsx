import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { View } from 'react-native';
import { HelperText, type TextInputProps } from 'react-native-paper';

import { TextInput } from '@/components/TextInput';
import type { IconName } from '@/components/StateViews';
import { useAppTheme } from '@/theme/theme';

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  secure?: boolean;
  /** Leading icon that says what the field is for at a glance. */
  icon?: IconName;
  /** Guidance shown under the field until it has an error. */
  hint?: string;
  /** Hide the built-in error line (when the caller renders its own, e.g. a password checklist). */
  hideError?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'label' | 'error'>;

/**
 * react-hook-form bound text field. The field's `ref` is registered with the
 * form, so screens can move focus with `setFocus(name)` (Return → next field)
 * and the form focuses the first invalid field on submit.
 */
export function FormField<T extends FieldValues>({ control, name, label, secure, icon, hint, hideError, ...rest }: Props<T>) {
  const theme = useAppTheme();
  const [hidden, setHidden] = useState(true);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur, ref }, fieldState: { error } }) => (
        <View>
          <TextInput
            ref={ref}
            mode="outlined"
            label={label}
            value={(value as string) ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
            secureTextEntry={secure && hidden}
            accessibilityLabel={label}
            accessibilityHint={error?.message ?? hint}
            outlineColor={theme.colors.border}
            left={icon ? <TextInput.Icon icon={icon} color={error ? theme.colors.error : theme.colors.textMuted} forceTextInputFocus={false} /> : undefined}
            right={
              secure ? (
                <TextInput.Icon
                  icon={hidden ? 'eye-outline' : 'eye-off-outline'}
                  color={theme.colors.textMuted}
                  onPress={() => setHidden((h) => !h)}
                  forceTextInputFocus={false}
                  accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
                />
              ) : undefined
            }
            {...rest}
          />
          {error && !hideError ? (
            <HelperText type="error" visible accessibilityLiveRegion="polite">
              {error.message}
            </HelperText>
          ) : hint && !error ? (
            <HelperText type="info" visible style={{ color: theme.colors.textMuted }}>
              {hint}
            </HelperText>
          ) : null}
        </View>
      )}
    />
  );
}
