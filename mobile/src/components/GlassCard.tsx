import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, shadows } from '../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  borderWidth?: number;
  radius?: number;
}

export function GlassCard({
  children,
  style,
  intensity = 25,
  borderWidth = 1,
  radius = 24,
}: GlassCardProps) {
  return (
    <View style={[styles.container, { borderRadius: radius }, shadows.glass, style]}>
      <BlurView
        intensity={intensity}
        tint="light"
        style={[styles.blur, { borderRadius: radius }]}
      >
        <View
          style={[
            styles.overlay,
            {
              borderRadius: radius,
              borderWidth,
              borderColor: colors.glass.border,
            },
          ]}
        >
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  blur: {
    overflow: 'hidden',
  },
  overlay: {
    backgroundColor: colors.glass.surface,
  },
});

export default GlassCard;
