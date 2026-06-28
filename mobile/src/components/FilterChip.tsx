import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { colors, borderRadius, spacing } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function FilterChip({
  label,
  selected = false,
  onPress,
  style,
}: FilterChipProps) {
  return (
    <AnimatedPressable
      onPress={onPress}
      scaleTo={0.95}
      haptics="light"
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipDefault,
        style,
      ]}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textDefault]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    marginRight: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
  },
  chipDefault: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.outlineVariant,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  textDefault: {
    color: colors.onSurface,
  },
  textSelected: {
    color: colors.onPrimary,
  },
});

export default FilterChip;
