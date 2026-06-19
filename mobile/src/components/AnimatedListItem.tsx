import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { useStaggeredItem } from '../hooks/animations';

interface AnimatedListItemProps {
  children: React.ReactNode;
  /** Item index in the list (determines stagger delay) */
  index: number;
  /** Delay between items in ms (default: 50) */
  staggerDelay?: number;
  /** Initial delay before first item in ms (default: 100) */
  initialDelay?: number;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Wrapper component for staggered list item animations.
 * Each item fades in with a slight upward motion, staggered by index.
 *
 * @example
 * {items.map((item, index) => (
 *   <AnimatedListItem key={item.id} index={index} staggerDelay={80}>
 *     <ItemCard {...item} />
 *   </AnimatedListItem>
 * ))}
 */
export function AnimatedListItem({
  children,
  index,
  staggerDelay = 50,
  initialDelay = 100,
  style,
  testID,
}: AnimatedListItemProps) {
  const animatedStyle = useStaggeredItem(index, {
    staggerDelay,
    initialDelay,
  });

  return (
    <Animated.View style={[style, animatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
}

export default AnimatedListItem;
