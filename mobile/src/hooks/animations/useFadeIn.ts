import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface UseFadeInOptions {
  /** Delay before animation starts in ms (default: 0) */
  delay?: number;
  /** Duration of animation in ms (default: 400) */
  duration?: number;
  /** Initial vertical offset in px (default: 20) */
  translateY?: number;
  /** Whether to auto-start the animation (default: true) */
  autoStart?: boolean;
}

/**
 * Hook for fade-in entrance animation with optional vertical translation.
 * Uses timing animation with cubic easing for a polished feel.
 *
 * @example
 * const fadeInStyle = useFadeIn({ delay: 100 });
 * <Animated.View style={fadeInStyle}>...</Animated.View>
 */
export function useFadeIn(options: UseFadeInOptions = {}) {
  const { delay = 0, duration = 400, translateY = 20, autoStart = true } = options;

  const opacity = useSharedValue(autoStart ? 0 : 1);
  const offset = useSharedValue(autoStart ? translateY : 0);

  useEffect(() => {
    if (!autoStart) return;

    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
    offset.value = withDelay(
      delay,
      withTiming(0, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, duration, translateY, autoStart]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  // Manual trigger for when autoStart is false
  const start = () => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
    offset.value = withDelay(
      delay,
      withTiming(0, { duration, easing: Easing.out(Easing.cubic) })
    );
  };

  return { animatedStyle, start };
}
