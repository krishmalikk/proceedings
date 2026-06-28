import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, borderRadius, spacing, shadows } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
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
    switch (elevation) {
      case 0:
        return {};
      case 2:
        return shadows.level2;
      default:
        return shadows.level1;
    }
  };

  const cardStyle = [
    styles.card,
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
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
});

export default Card;
