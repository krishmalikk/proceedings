import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Badge } from './Badge';
import { colors, spacing, borderRadius } from '../constants/theme';

interface AttorneyCardProps {
  name: string;
  title: string;
  firm: string;
  imageUrl?: string;
  barAdmission: string;
  specialties: string[];
  languages: string[];
  responseRate: string;
  responseTime: string;
  onPress?: () => void;
}

export function AttorneyCard({
  name,
  title,
  firm,
  imageUrl,
  barAdmission,
  specialties,
  languages,
  responseRate,
  responseTime,
  onPress,
}: AttorneyCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={32} color={colors.outline} />
              </View>
            )}
          </View>
          <View style={styles.verifiedBadge}>
            <Badge variant="success">VERIFIED</Badge>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <View style={styles.barBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
              <Text style={styles.barText}>{barAdmission}</Text>
            </View>
          </View>
          <Text style={styles.firm}>{firm}</Text>

          <View style={styles.specialties}>
            {specialties.map((specialty, index) => (
              <View key={index} style={styles.specialtyChip}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>LANGUAGES</Text>
            <View style={styles.statValue}>
              <Ionicons name="language" size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.statText}>{languages.join(', ')}</Text>
            </View>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>RESPONSE RATE</Text>
            <View style={styles.statValue}>
              <Ionicons name="flash" size={16} color={colors.secondary} />
              <Text style={styles.statText}>{responseRate} ({responseTime})</Text>
            </View>
          </View>
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
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    alignItems: 'flex-start',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.lg,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  info: {
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginRight: spacing.sm,
  },
  barBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  barText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSecondaryContainer,
    marginLeft: 4,
  },
  firm: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specialtyChip: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginRight: spacing.base,
    marginBottom: spacing.xs,
  },
  specialtyText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.outline,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 13,
    color: colors.onSurface,
    marginLeft: 4,
  },
});

export default AttorneyCard;
