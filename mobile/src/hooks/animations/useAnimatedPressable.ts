import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type HapticType = 'light' | 'medium' | 'heavy' | 'none';

interface UseAnimatedPressableOptions {
  /** Scale factor when pressed (default: 0.96) */
  scaleTo?: number;
  /** Duration of press-in animation in ms (default: 100) */
  duration?: number;
  /** Haptic feedback intensity (default: 'light') */
  haptics?: HapticType;
}

/**
 * Hook for animated press feedback with scale + haptics.
 * All animations run on the UI thread via worklets for 60fps.
 *
 * @example
 * const { animatedStyle, gestureHandler } = useAnimatedPressable();
 * <GestureDetector gesture={gestureHandler}>
 *   <Animated.View style={animatedStyle}>...</Animated.View>
 * </GestureDetector>
 */
export function useAnimatedPressable(options: UseAnimatedPressableOptions = {}) {
  const { scaleTo = 0.96, duration = 100, haptics = 'light' } = options;
  const scale = useSharedValue(1);

  const triggerHaptics = useCallback(() => {
    if (haptics === 'none') return;
    const style =
      haptics === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : haptics === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style);
  }, [haptics]);

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withTiming(scaleTo, { duration });
    runOnJS(triggerHaptics)();
  }, [scaleTo, duration, triggerHaptics]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return {
    animatedStyle,
    onPressIn,
    onPressOut,
    scale,
  };
}
