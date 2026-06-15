import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, spacing, borderRadius } from '../constants/theme';

export type PostingCardData = {
  case_id: string;
  title: string;
  description: string;
  visa: string[];
  consulates: string[];
  outcome: string;
  subreddit: string;
  channel: string;
  tags: string[];
  url: string;
  date: string;
  timestamp?: string; // full ingestion timestamp (for relative "X ago")
};

interface PostingCardProps {
  posting: PostingCardData;
  onPress?: () => void;
}

// Relative "X ago" for data-freshness (mirrors ReplyItem/GroupChat).
function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

function getOutcomeBadgeStyle(outcome: string) {
  const o = outcome.toLowerCase();
  if (o === 'approved' || o === 'issued') {
    return { backgroundColor: colors.secondaryContainer, color: colors.onSecondaryContainer };
  }
  return { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurfaceVariant };
}

export function PostingCard({ posting, onPress }: PostingCardProps) {
  const outcomeStyle = posting.outcome ? getOutcomeBadgeStyle(posting.outcome) : null;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.card}>
        {/* Badges row */}
        <View style={styles.badgesRow}>
          {posting.outcome && (
            <View style={[styles.badge, { backgroundColor: outcomeStyle?.backgroundColor }]}>
              <Text style={[styles.badgeText, { color: outcomeStyle?.color }]}>
                {posting.outcome}
              </Text>
            </View>
          )}
          {posting.visa.slice(0, 2).map((v) => (
            <View key={v} style={[styles.badge, styles.primaryBadge]}>
              <Text style={styles.primaryBadgeText}>{v}</Text>
            </View>
          ))}
          {posting.consulates.slice(0, 2).map((c) => (
            <View key={c} style={[styles.badge, styles.locationBadge]}>
              <Ionicons name="location-outline" size={12} color={colors.onSurfaceVariant} />
              <Text style={styles.locationBadgeText}>{c}</Text>
            </View>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {posting.title}
        </Text>

        {/* Description */}
        {posting.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {posting.description}
          </Text>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.source}>
            {posting.subreddit ? `r/${posting.subreddit}` : posting.channel} ·{' '}
            {timeAgo(posting.timestamp || posting.date) || posting.date}
          </Text>
          <View style={styles.viewMore}>
            <Text style={styles.viewMoreText}>View experience</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.base,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  primaryBadge: {
    backgroundColor: colors.primaryContainer,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onPrimaryContainer,
  },
  locationBadge: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 22,
    marginBottom: spacing.base,
  },
  description: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  source: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  viewMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewMoreText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
});

export default PostingCard;
