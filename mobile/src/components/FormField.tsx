import { useState } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { View } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  secure?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'label' | 'error'>;

export function FormField<T extends FieldValues>({ control, name, label, secure, ...rest }: Props<T>) {
  const [hidden, setHidden] = useState(true);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View>
          <TextInput
            mode="outlined"
            label={label}
            value={(value as string) ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
            secureTextEntry={secure && hidden}
            accessibilityLabel={label}
            right={
              secure ? (
                <TextInput.Icon
                  icon={hidden ? 'eye-outline' : 'eye-off-outline'}
                  onPress={() => setHidden((h) => !h)}
                  accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
                />
              ) : undefined
            }
            {...rest}
          />
          {error ? (
            <HelperText type="error" visible>
              {error.message}
            </HelperText>
          ) : null}
        </View>
      )}
    />
  );
}
