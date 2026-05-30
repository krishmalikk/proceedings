import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';
import type { Experience } from '../../services/vertexSearchService';

export interface AIResultCardProps {
  experience: Experience;
  onPress?: () => void;
}

export function AIResultCard({ experience, onPress }: AIResultCardProps) {
  const getOutcomeColor = () => {
    switch (experience.outcome) {
      case 'approved':
        return colors.statusResolved;
      case 'denied':
        return colors.error;
      case 'pending':
        return colors.statusInProgress;
      default:
        return colors.outline;
    }
  };

  const getOutcomeIcon = () => {
    switch (experience.outcome) {
      case 'approved':
        return 'checkmark-circle';
      case 'denied':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={styles.visaTypeBadge}>
          <Text style={styles.visaTypeText}>{experience.visaType}</Text>
        </View>
        <View style={[styles.outcomeBadge, { backgroundColor: getOutcomeColor() + '20' }]}>
          <Ionicons name={getOutcomeIcon()} size={14} color={getOutcomeColor()} />
          <Text style={[styles.outcomeText, { color: getOutcomeColor() }]}>
            {experience.outcome.charAt(0).toUpperCase() + experience.outcome.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {experience.title}
      </Text>

      <Text style={styles.summary} numberOfLines={2}>
        {experience.summary}
      </Text>

      <View style={styles.footer}>
        {experience.consulate && (
          <View style={styles.footerItem}>
            <Ionicons name="location-outline" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.footerText}>{experience.consulate}</Text>
          </View>
        )}
        {experience.interviewDate && (
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.onSurfaceVariant} />
            <Text style={styles.footerText}>
              {new Date(experience.interviewDate).toLocaleDateString()}
            </Text>
          </View>
        )}
        <View style={styles.footerItem}>
          <Ionicons name="arrow-up" size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.footerText}>{experience.upvotes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.marginMobile,
    ...shadows.level1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    gap: spacing.base,
  },
  visaTypeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  visaTypeText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  outcomeText: {
    ...typography.caption,
    fontWeight: '500',
  },
  title: {
    ...typography.labelMd,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  summary: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    ...typography.caption,
    color: colors.onSurfaceVariant,
  },
});
