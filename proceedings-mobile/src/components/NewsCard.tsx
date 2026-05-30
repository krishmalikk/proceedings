import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, spacing, borderRadius } from '../constants/theme';

interface NewsCardProps {
  source: string;
  date: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  relevanceTag?: string;
  onPress?: () => void;
}

export function NewsCard({
  source,
  date,
  title,
  excerpt,
  imageUrl,
  relevanceTag,
  onPress,
}: NewsCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>{source}</Text>
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.excerpt} numberOfLines={3}>
          {excerpt}
        </Text>

        {relevanceTag && (
          <View style={styles.relevanceContainer}>
            <View style={styles.relevanceBadge}>
              <Ionicons name="alert-circle" size={14} color={colors.primary} />
              <Text style={styles.relevanceText}>{relevanceTag}</Text>
            </View>
          </View>
        )}

        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sourceBadge: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  date: {
    fontSize: 12,
    color: colors.outline,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 24,
    marginBottom: spacing.base,
  },
  excerpt: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 21,
  },
  relevanceContainer: {
    marginTop: spacing.sm,
  },
  relevanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.default,
    alignSelf: 'flex-start',
  },
  relevanceText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 6,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.default,
    marginTop: spacing.sm,
  },
});

export default NewsCard;
