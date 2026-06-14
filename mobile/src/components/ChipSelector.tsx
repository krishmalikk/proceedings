import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FilterChip } from './FilterChip';
import { colors, spacing } from '../constants/theme';

interface ChipSelectorProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  multiSelect?: boolean;
  horizontal?: boolean;
}

export function ChipSelector({
  label,
  options,
  selectedValues,
  onSelectionChange,
  multiSelect = true,
  horizontal = false,
}: ChipSelectorProps) {
  const handleChipPress = (option: string) => {
    if (multiSelect) {
      if (selectedValues.includes(option)) {
        onSelectionChange(selectedValues.filter((v) => v !== option));
      } else {
        onSelectionChange([...selectedValues, option]);
      }
    } else {
      onSelectionChange([option]);
    }
  };

  const ChipContainer = horizontal ? ScrollView : View;
  const containerProps = horizontal
    ? { horizontal: true, showsHorizontalScrollIndicator: false }
    : {};

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <ChipContainer
        {...containerProps}
        style={horizontal ? styles.horizontalScroll : styles.chipContainer}
        contentContainerStyle={horizontal ? styles.horizontalContent : undefined}
      >
        {options.map((option) => (
          <FilterChip
            key={option}
            label={option}
            selected={selectedValues.includes(option)}
            onPress={() => handleChipPress(option)}
          />
        ))}
      </ChipContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  horizontalScroll: {
    flexGrow: 0,
  },
  horizontalContent: {
    paddingRight: spacing.md,
  },
});

export default ChipSelector;
