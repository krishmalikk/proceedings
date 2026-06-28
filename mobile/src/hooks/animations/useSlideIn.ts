import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

type Direction = 'left' | 'right' | 'up' | 'down';

interface UseSlideInOptions {
  /** Direction to slide from (default: 'up') */
  direction?: Direction;
  /** Delay before animation starts in ms (default: 0) */
  delay?: number;
  /** Distance to slide in px (default: 30) */
  distance?: number;
  /** Spring damping (default: 18) */
  damping?: number;
  /** Spring stiffness (default: 180) */
  stiffness?: number;
}

/**
 * Hook for slide-in entrance animation with spring physics.
 * Supports all four directions with configurable spring settings.
 *
 * @example
 * const slideInStyle = useSlideIn({ direction: 'right', delay: 50 });
 * <Animated.View style={slideInStyle}>...</Animated.View>
 */
export function useSlideIn(options: UseSlideInOptions = {}) {
  const {
    direction = 'up',
    delay = 0,
    distance = 30,
    damping = 18,
    stiffness = 180,
  } = options;

  const initialX =
    direction === 'left' ? -distance : direction === 'right' ? distance : 0;
  const initialY =
    direction === 'up' ? distance : direction === 'down' ? -distance : 0;

  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const springConfig = { damping, stiffness };

    translateX.value = withDelay(delay, withSpring(0, springConfig));
    translateY.value = withDelay(delay, withSpring(0, springConfig));
    opacity.value = withDelay(delay, withSpring(1, springConfig));
  }, [delay, direction, distance, damping, stiffness]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return animatedStyle;
}
