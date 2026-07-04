import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, spacing } from '../constants/theme';

/**
 * ScreenHeader — THE screen header (design-system chrome primitive).
 *
 * Replaces the four hand-rolled header patterns (Georgia Header.tsx, Lora
 * customs, system-bold customs, glass): one back-chevron slot, a Lora
 * `headlineMd` centered title, and an optional right-action slot that keeps
 * the title optically centered.
 *
 *   <ScreenHeader title="Case Details" />
 *   <ScreenHeader title="Group" onBack={...} rightAction={<Menu />} />
 *   <ScreenHeader title="Home" large rightAction={<Fab />} />   // no back, left-aligned
 */
export interface ScreenHeaderProps {
  title: string;
  /** Show the back chevron (default true). `large` headers default to false. */
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** Tab-root style: bigger left-aligned title, no back chevron. */
  large?: boolean;
  style?: ViewStyle;
}

export function ScreenHeader({ title, showBack, onBack, rightAction, large = false, style }: ScreenHeaderProps) {
  // Context (not useNavigation) so the header renders outside a
  // NavigationContainer too (component tests, storybook-style harnesses).
  const navigation = React.useContext(NavigationContext);
  const back = showBack ?? !large;
  const handleBack = onBack ?? (() => navigation?.goBack());

  if (large) {
    return (
      <View style={[styles.largeContainer, style]}>
        <AppText variant="headlineLgMobile" style={styles.largeTitle}>
          {title}
        </AppText>
        {rightAction ? <View style={styles.rightSlot}>{rightAction}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {back ? (
        <TouchableOpacity
          style={styles.sideSlot}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      ) : (
        <View style={styles.sideSlot} />
      )}
      <AppText variant="headlineMd" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.sideSlot}>{rightAction ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.background,
  },
  sideSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  largeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    backgroundColor: colors.background,
  },
  largeTitle: {
    flex: 1,
  },
  rightSlot: {
    marginLeft: spacing.sm,
  },
});

export default ScreenHeader;
