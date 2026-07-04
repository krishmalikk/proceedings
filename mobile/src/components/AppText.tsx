import React from 'react';
import { Text, TextProps, TextStyle, StyleSheet } from 'react-native';
import { colors, typography } from '../constants/theme';

/**
 * AppText — the canonical text component of the Meridian design system.
 *
 * Every visible string should render through this (new code MUST — see
 * AGENTS.md). It pins the brand fonts via the `typography` tokens so text can
 * never silently fall back to the system face, and it makes the type scale
 * grep-able: migrating a screen off inline `fontSize:` literals means swapping
 * its <Text> for <AppText variant="...">.
 *
 *   <AppText variant="headlineMd">Section title</AppText>
 *   <AppText variant="bodyMd" color="onSurfaceVariant" numberOfLines={2}>…</AppText>
 *
 * `variant` keys into theme.typography (family/size/lineHeight — weight lives
 * in the family name, never set fontWeight alongside). `color` keys into
 * theme.colors (string tokens only). Extra styles compose via `style` as
 * usual and win over the variant.
 */

export type AppTextVariant = keyof typeof typography;

// Only string color tokens are valid (skips nested palettes like glass/orb).
export type AppTextColor = {
  [K in keyof typeof colors]: (typeof colors)[K] extends string ? K : never;
}[keyof typeof colors];

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: AppTextColor;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'bodyMd',
  color = 'onSurface',
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: colors[color] as string },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Convenience for StyleSheet-based callers that need the same composition.
export function textStyle(variant: AppTextVariant, color: AppTextColor = 'onSurface'): TextStyle {
  return StyleSheet.flatten([typography[variant] as TextStyle, { color: colors[color] as string }]);
}

export default AppText;
