import React from 'react';
import {
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { colors, borderRadius, spacing, typography } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'right',
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: disabled ? colors.surfaceDim : colors.primary,
          },
          text: { color: colors.onPrimary },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: disabled ? colors.outlineVariant : colors.outline,
          },
          text: { color: disabled ? colors.outline : colors.onSurface },
        };
      case 'ghost':
        return {
          container: { backgroundColor: 'transparent' },
          text: { color: disabled ? colors.outline : colors.primary },
        };
      case 'link':
        return {
          container: { backgroundColor: 'transparent', paddingHorizontal: 0 },
          text: {
            color: disabled ? colors.outline : colors.primary,
            textDecorationLine: 'underline',
          },
        };
      default:
        return {
          container: { backgroundColor: colors.primary },
          text: { color: colors.onPrimary },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingVertical: 8, paddingHorizontal: 16 },
          text: { fontSize: 14 },
        };
      case 'lg':
        return {
          container: { paddingVertical: 16, paddingHorizontal: 24 },
          text: { fontSize: 18 },
        };
      default:
        return {
          container: { paddingVertical: 12, paddingHorizontal: 20 },
          text: { fontSize: 16 },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Primary buttons get medium haptics, others get light
  const hapticStrength = variant === 'primary' ? 'medium' : 'light';

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.97}
      haptics={hapticStrength}
      style={[
        styles.button,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.text.color} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text
            style={[
              styles.text,
              variantStyles.text,
              sizeStyles.text,
              icon && iconPosition === 'left' ? { marginLeft: spacing.base } : undefined,
              icon && iconPosition === 'right' ? { marginRight: spacing.base } : undefined,
              textStyle,
            ]}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.default,
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    // Brand body face; weight lives in the family name (see AGENTS.md).
    fontFamily: 'NunitoSans_600SemiBold',
    textAlign: 'center',
  },
});

export default Button;
