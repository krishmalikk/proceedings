import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius, typography } from '../constants/theme';

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
  default: { bg: colors.surfaceContainerHigh, text: colors.onSurface },
  primary: { bg: colors.primary, text: colors.onPrimary },
  secondary: { bg: colors.secondary, text: colors.onSecondary },
  success: { bg: '#dcfce7', text: '#166534' },
  warning: { bg: '#fef3c7', text: '#92400e' },
  info: { bg: colors.primaryFixed, text: colors.primary },
  outline: { bg: 'transparent', text: colors.onSurface, border: colors.outline },
};

export function Badge({ children, variant = 'default', style, textStyle }: BadgeProps) {
  const variantStyle = variantStyles[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: variantStyle.bg },
        variantStyle.border && { borderWidth: 1, borderColor: variantStyle.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: variantStyle.text }, textStyle]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
    lineHeight: typography.caption.lineHeight,
  },
});

export default Badge;
