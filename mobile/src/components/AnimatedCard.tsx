import React from 'react';
import { ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from './Card';
import { useFadeIn } from '../hooks/animations';

interface AnimatedCardProps {
  children: React.ReactNode;
  /** Container style */
  style?: ViewStyle;
  /** Animation delay in ms (default: 0) */
  delay?: number;
  /** Card elevation (default: 1) */
  elevation?: 0 | 1 | 2;
  /** Card padding (default: 'md') */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Test ID for testing */
  testID?: string;
}

/**
 * Card component with fade-in entrance animation.
 * Wraps the standard Card with a smooth opacity + translateY animation.
 *
 * @example
 * <AnimatedCard delay={100} elevation={2}>
 *   <Text>Card content</Text>
 * </AnimatedCard>
 */
export function AnimatedCard({
  children,
  style,
  delay = 0,
  elevation = 1,
  padding = 'md',
  testID,
}: AnimatedCardProps) {
  const { animatedStyle } = useFadeIn({ delay, translateY: 16 });

  return (
    <Animated.View style={animatedStyle} testID={testID}>
      <Card style={style} elevation={elevation} padding={padding}>
        {children}
      </Card>
    </Animated.View>
  );
}

export default AnimatedCard;
