import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Badge } from './Badge';
import { colors, spacing, borderRadius } from '../constants/theme';

interface ThreadCardProps {
  tags: string[];
  title: string;
  excerpt: string;
  timeAgo: string;
  views: number;
  comments: number;
  helpfulCount: number;
  onPress?: () => void;
}

export function ThreadCard({
  tags,
  title,
  excerpt,
  timeAgo,
  views,
  comments,
  helpfulCount,
  onPress,
}: ThreadCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.tags}>
            {tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.excerpt} numberOfLines={2}>
          {excerpt}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.statText}>{views}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.statText}>{comments} Comments</Text>
          </View>
          <View style={[styles.stat, styles.helpful]}>
            <Ionicons name="heart" size={16} color={colors.secondary} />
            <Text style={[styles.statText, styles.helpfulText]}>{helpfulCount} Helpful</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  tag: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.outline,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.base,
    lineHeight: 22,
  },
  excerpt: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginLeft: 4,
  },
  helpful: {
    marginLeft: 'auto',
    marginRight: 0,
  },
  helpfulText: {
    color: colors.secondary,
    fontWeight: '500',
  },
});

export default ThreadCard;
