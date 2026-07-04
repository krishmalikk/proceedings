import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, spacing } from '../constants/theme';

/**
 * EmptyState — shared "nothing here yet" panel (design-system state primitive).
 *
 *   <EmptyState
 *     icon="chatbubbles-outline"
 *     title="No replies yet"
 *     body="Be the first to share your experience."
 *     actionLabel="Write a reply"
 *     onAction={() => ...}
 *   />
 */
export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({ icon = 'file-tray-outline', title, body, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={colors.onSurfaceVariant} />
      </View>
      <AppText variant="headlineMd" align="center" style={styles.title}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="bodyMd" color="onSurfaceVariant" align="center" style={styles.body}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction} variant="secondary" size="sm" style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  body: {
    maxWidth: 300,
  },
  action: {
    marginTop: spacing.md,
  },
});

export default EmptyState;
