import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, shadows } from '../constants/theme';

interface GlassButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  size?: number;
  style?: ViewStyle;
  disabled?: boolean;
}

export function GlassButton({
  children,
  onPress,
  size = 44,
  style,
  disabled = false,
}: GlassButtonProps) {
  const radius = size / 2;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius },
        shadows.glass,
        style,
      ]}
    >
      <BlurView
        intensity={30}
        tint="light"
        style={[styles.blur, { borderRadius: radius }]}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.7}
          style={[
            styles.inner,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
        >
          {children}
        </TouchableOpacity>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  blur: {
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: colors.glass.surface,
    borderWidth: 1,
    borderColor: colors.glass.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GlassButton;
