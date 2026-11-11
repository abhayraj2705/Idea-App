import type { ComponentProps } from 'react';
import { TextInput as PaperTextInput } from 'react-native-paper';

import { radius } from '@/theme/radius';

type Props = ComponentProps<typeof PaperTextInput>;

/**
 * Paper's outlined input takes its corner radius straight from `theme.roundness`
 * (3px), while buttons multiply it by 5 and cards by 3. That left square-ish
 * fields next to rounded buttons. This wrapper gives inputs the same 12px radius
 * as cards and controls. Use it everywhere instead of Paper's TextInput.
 * (React 19 passes `ref` through as a regular prop, so no forwardRef is needed.)
 */
function Base({ outlineStyle, ...rest }: Props) {
  return <PaperTextInput outlineStyle={[{ borderRadius: radius.control }, outlineStyle]} {...rest} />;
}

export const TextInput = Object.assign(Base, { Icon: PaperTextInput.Icon, Affix: PaperTextInput.Affix });
