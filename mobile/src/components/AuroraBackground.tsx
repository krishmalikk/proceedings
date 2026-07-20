import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Canvas,
  Fill,
  Circle,
  Blur,
  Group,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { colors } from '../constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const TAU = Math.PI * 2;

export interface AuroraBackgroundProps {
  /** Vertical anchor (px) for the radial-gradient core + the pulsing bloom.
   *  Defaults to H * 0.39 (tuned to sit behind the Welcome logo). Point it at
   *  wherever the consuming screen's focal art sits. */
  focalY?: number;
  /** Render the pulsing bloom behind the focal point. Default true. */
  showBloom?: boolean;
}

/**
 * The shared "Dark Aurora" background — a full-screen Skia canvas with a dark
 * radial ground, three slowly drifting blurred orbs, and (optionally) a gently
 * pulsing bloom at `focalY`. Renders only the absolute-fill Canvas; the consumer
 * stacks its own content on top as a sibling.
 */
export function AuroraBackground({ focalY, showBloom = true }: AuroraBackgroundProps) {
  const focal = focalY ?? H * 0.39;

  // Slow continuous drift for the ambient orbs.
  const t = useSharedValue(0);
  // Gentle in/out pulse for the focal bloom ("breathing").
  const pulse = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [t, pulse]);

  const orb1x = useDerivedValue(() => W * 0.26 + Math.sin(t.value * TAU) * 28);
  const orb1y = useDerivedValue(() => H * 0.18 + Math.cos(t.value * TAU) * 24);
  const orb2x = useDerivedValue(() => W * 0.74 + Math.cos(t.value * TAU) * 32);
  const orb2y = useDerivedValue(() => H * 0.28 + Math.sin(t.value * TAU) * 26);
  const orb3x = useDerivedValue(() => W * 0.32 + Math.sin(t.value * TAU + 1.6) * 30);
  const orb3y = useDerivedValue(() => H * 0.74 + Math.cos(t.value * TAU + 1.6) * 28);
  const bloomR = useDerivedValue(() => 118 + pulse.value * 28);
  const bloomOpacity = useDerivedValue(() => 0.42 + pulse.value * 0.24);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill>
        <RadialGradient
          c={vec(W / 2, focal)}
          r={H * 0.82}
          colors={colors.welcomeDark as unknown as string[]}
        />
      </Fill>

      <Group opacity={0.5}>
        <Circle cx={orb1x} cy={orb1y} r={140} color={colors.primary}>
          <Blur blur={70} />
        </Circle>
      </Group>
      <Group opacity={0.42}>
        <Circle cx={orb2x} cy={orb2y} r={160} color={colors.accent}>
          <Blur blur={80} />
        </Circle>
      </Group>
      <Group opacity={0.32}>
        <Circle cx={orb3x} cy={orb3y} r={150} color={colors.orb.pink}>
          <Blur blur={80} />
        </Circle>
      </Group>

      {showBloom && (
        <Group opacity={bloomOpacity}>
          <Circle cx={W / 2} cy={focal} r={bloomR} color={colors.primary}>
            <Blur blur={55} />
          </Circle>
        </Group>
      )}
    </Canvas>
  );
}

export default AuroraBackground;
