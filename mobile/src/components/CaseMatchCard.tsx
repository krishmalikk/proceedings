import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Badge } from './Badge';
import { colors, spacing, borderRadius } from '../constants/theme';

interface CaseMatchCardProps {
  matchPercentage: number;
  isVerified?: boolean;
  isResolved?: boolean;
  title: string;
  tags: string[];
  similarCases: number;
  timeAgo: string;
  onPress?: () => void;
}

export function CaseMatchCard({
  matchPercentage,
  isVerified = false,
  isResolved = false,
  title,
  tags,
  similarCases,
  timeAgo,
  onPress,
}: CaseMatchCardProps) {
  const getMatchColor = () => {
    if (matchPercentage >= 90) return colors.statusResolved;
    if (matchPercentage >= 70) return colors.secondary;
    return colors.statusInProgress;
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.badges}>
            <View style={[styles.matchBadge, { backgroundColor: getMatchColor() }]}>
              <Text style={styles.matchText}>{matchPercentage}%</Text>
              <Text style={styles.matchLabel}>Match</Text>
            </View>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
                <Text style={styles.verifiedText}>Attorney-verified</Text>
              </View>
            )}
            {isResolved && (
              <Badge variant="success" style={styles.resolvedBadge}>Resolved</Badge>
            )}
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.tags}>
          {tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.similarCases}>
            <Ionicons name="copy-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.similarText}>{similarCases} similar cases</Text>
          </View>
          <TouchableOpacity style={styles.viewLink}>
            <Text style={styles.viewLinkText}>View Case Analysis</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginRight: spacing.base,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginRight: 4,
  },
  matchLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.base,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.secondary,
    marginLeft: 4,
  },
  resolvedBadge: {
    marginTop: 4,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.outline,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginRight: spacing.base,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  tagText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  similarCases: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginLeft: 4,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewLinkText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginRight: 4,
  },
});

export default CaseMatchCard;
