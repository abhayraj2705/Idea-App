import type { ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { useAppTheme } from '@/theme/theme';

type Props = ComponentProps<typeof SegmentedButtons>;

/**
 * App-wide segmented control.
 *
 * - Paper paints the checked segment with `secondaryContainer`, which in Lumen
 *   is a near-white grey (#F4F4F5): the selected filter was practically
 *   invisible. An accent tint is scoped to this control only (chips also use
 *   secondaryContainer and must stay neutral).
 * - With large system text the icons are dropped so labels don't truncate.
 */
export function Segmented(props: Props) {
  const theme = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const compact = fontScale > 1.3;
  const resolved = (
    compact ? { ...props, buttons: props.buttons.map(({ icon: _icon, ...b }) => ({ ...b, labelStyle: [b.labelStyle, { fontSize: 12 }] })) } : props
  ) as Props;
  return (
    <SegmentedButtons
      {...resolved}
      theme={{
        colors: {
          secondaryContainer: theme.colors.primaryContainer,
          onSecondaryContainer: theme.colors.onPrimaryContainer,
          outline: theme.colors.border,
        },
      }}
    />
  );
}
