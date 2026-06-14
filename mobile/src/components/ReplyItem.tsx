import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoteControl } from './VoteControl';
import { colors, spacing, borderRadius } from '../constants/theme';

export type ReplyCardData = {
  id: string;
  parent_case_id: string;
  body: string;
  author_handle: string;
  created_at: string;
  deleted: boolean;
  up: number;
  down: number;
  score: number;
  your_vote: number;
  is_author: boolean;
};

interface ReplyItemProps {
  reply: ReplyCardData;
  onDelete?: (id: string) => void;
}

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

export function ReplyItem({ reply, onDelete }: ReplyItemProps) {
  const handleDelete = () => {
    Alert.alert(
      'Delete Reply',
      'Are you sure you want to delete this reply?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(reply.id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.voteColumn}>
        <VoteControl
          contentId={reply.id}
          score={reply.score}
          yourVote={reply.your_vote}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.author}>{reply.author_handle}</Text>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.time}>{timeAgo(reply.created_at)}</Text>
          {reply.is_author && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.body}>{reply.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  voteColumn: {
    paddingTop: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  author: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  separator: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  time: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  deleteButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  body: {
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 20,
  },
});

export default ReplyItem;
