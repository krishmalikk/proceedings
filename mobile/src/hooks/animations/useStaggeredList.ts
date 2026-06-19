import { useCallback, useRef, useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';

interface UseStaggeredListOptions {
  /** Delay between each item in ms (default: 50) */
  staggerDelay?: number;
  /** Initial delay before first item in ms (default: 100) */
  initialDelay?: number;
  /** Vertical offset to slide from in px (default: 20) */
  translateY?: number;
  /** Spring damping (default: 20) */
  damping?: number;
}

interface StaggeredItemAnimation {
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
}

/**
 * Hook for staggered list entrance animations.
 * Returns a function to get animated style for each item by index.
 *
 * @example
 * const { getItemStyle } = useStaggeredList(items.length);
 * {items.map((item, i) => (
 *   <Animated.View key={item.id} style={getItemStyle(i)}>
 *     ...
 *   </Animated.View>
 * ))}
 */
export function useStaggeredList(
  itemCount: number,
  options: UseStaggeredListOptions = {}
) {
  const {
    staggerDelay = 50,
    initialDelay = 100,
    translateY = 20,
    damping = 20,
  } = options;

  // Store animation values for each item
  const animations = useRef<Map<number, StaggeredItemAnimation>>(new Map());

  // Create or get animation values for an index
  const getOrCreateAnimation = useCallback(
    (index: number): StaggeredItemAnimation => {
      if (!animations.current.has(index)) {
        animations.current.set(index, {
          opacity: { value: 0 } as SharedValue<number>,
          translateY: { value: translateY } as SharedValue<number>,
        });
      }
      return animations.current.get(index)!;
    },
    [translateY]
  );

  // Hook to create animated style for a specific index
  const useItemAnimation = (index: number) => {
    const opacity = useSharedValue(0);
    const offset = useSharedValue(translateY);
    const delay = initialDelay + index * staggerDelay;

    useEffect(() => {
      opacity.value = withDelay(
        delay,
        withSpring(1, { damping, stiffness: 180 })
      );
      offset.value = withDelay(
        delay,
        withSpring(0, { damping, stiffness: 180 })
      );
    }, [delay]);

    return useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: offset.value }],
    }));
  };

  return { useItemAnimation };
}

/**
 * Simpler hook for a single staggered item.
 * Use this inside list item components.
 *
 * @example
 * function ListItem({ index }: { index: number }) {
 *   const animatedStyle = useStaggeredItem(index);
 *   return <Animated.View style={animatedStyle}>...</Animated.View>;
 * }
 */
export function useStaggeredItem(
  index: number,
  options: UseStaggeredListOptions = {}
) {
  const {
    staggerDelay = 50,
    initialDelay = 100,
    translateY = 20,
    damping = 20,
  } = options;

  const opacity = useSharedValue(0);
  const offset = useSharedValue(translateY);
  const delay = initialDelay + index * staggerDelay;

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSpring(1, { damping, stiffness: 180 })
    );
    offset.value = withDelay(
      delay,
      withSpring(0, { damping, stiffness: 180 })
    );
  }, [delay, damping]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));
}
