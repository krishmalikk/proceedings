import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, borderRadius, spacing, shadows } from '../constants/theme';

type CardVariant = 'elevated' | 'outlined' | 'filled';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * Surface treatment (A3 consolidation):
   * - `elevated` — white + soft shadow, NO border (the old border+shadow combo
   *    read as visually redundant). Default.
   * - `outlined` — white + 1px outlineVariant border, no shadow.
   * - `filled`   — tinted surfaceContainerLow, neither border nor shadow.
   */
  variant?: CardVariant;
  elevation?: 0 | 1 | 2;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Enable entrance animation (FadeInDown) */
  animated?: boolean;
  /** Delay in ms for entrance animation (default: 0) */
  animationDelay?: number;
}

export function Card({
  children,
  style,
  variant = 'elevated',
  elevation = 1,
  padding = 'md',
  animated = false,
  animationDelay = 0,
}: CardProps) {
  const getPaddingValue = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return spacing.sm;
      case 'lg':
        return spacing.lg;
      default:
        return spacing.md;
    }
  };

  const getElevationStyle = () => {
    // Shadows apply only to the elevated variant.
    if (variant !== 'elevated') return {};
    switch (elevation) {
      case 0:
        return {};
      case 2:
        return shadows.level2;
      default:
        return shadows.level1;
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        };
      case 'filled':
        return { backgroundColor: colors.surfaceContainerLow };
      default:
        return { backgroundColor: colors.surfaceContainerLowest };
    }
  };

  const cardStyle = [
    styles.card,
    getVariantStyle(),
    { padding: getPaddingValue() },
    getElevationStyle(),
    style,
  ];

  if (animated) {
    return (
      <Animated.View
        entering={FadeInDown.delay(animationDelay).duration(300).springify()}
        style={cardStyle}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <View style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
  },
});

export default Card;
