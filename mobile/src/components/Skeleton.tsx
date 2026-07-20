import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '../constants/theme';

/**
 * Skeleton — shared loading placeholders (design-system state primitive).
 *
 * A soft opacity pulse (0.45 ↔ 1) on surface-toned blocks: no gradient
 * choreography, one animated value per block, trivially jest-mockable.
 *
 *   <Skeleton.Line width="60%" />
 *   <Skeleton.Circle size={40} />
 *   <Skeleton.Card />            // PostingCard-shaped placeholder
 *   <Skeleton.Card count={3} />  // a short feed of them
 */

function usePulse() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

function Block({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const pulse = usePulse();
  return <Animated.View style={[styles.block, style, pulse]} />;
}

function Line({
  width = '100%',
  height = 14,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: ViewStyle;
}) {
  return <Block style={[{ width, height, borderRadius: borderRadius.sm }, style ?? {}]} />;
}

function Circle({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  return <Block style={[{ width: size, height: size, borderRadius: size / 2 }, style ?? {}]} />;
}

/** A PostingCard-shaped placeholder: badge row, title lines, footer. */
function SkeletonCard({ count = 1, style }: { count?: number; style?: ViewStyle }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.card, style]}>
          <View style={styles.badgeRow}>
            <Line width={64} height={18} />
            <Line width={48} height={18} />
          </View>
          <Line width="88%" height={16} style={styles.gap} />
          <Line width="70%" height={16} style={styles.gap} />
          <Line width="45%" height={12} style={styles.footerGap} />
        </View>
      ))}
    </>
  );
}

export const Skeleton = Object.assign(Block, {
  Line,
  Circle,
  Card: SkeletonCard,
});

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  gap: {
    marginBottom: spacing.base,
  },
  footerGap: {
    marginTop: spacing.base,
  },
});

export default Skeleton;
