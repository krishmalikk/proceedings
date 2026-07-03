import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReplyItem, ReplyCardData } from './ReplyItem';
import { colors, spacing, borderRadius } from '../constants/theme';
import { getReplies, postReply, deleteReply, getActiveUserId } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';

type Tally = { up: number; down: number; score: number; your_vote: number };

interface RepliesProps {
  postingId: string;
  onPostingTally?: (tally: Tally) => void;
}

export function Replies({ postingId, onPostingTally }: RepliesProps) {
  const [replies, setReplies] = useState<ReplyCardData[]>([]);
  const [sort, setSort] = useState<'top' | 'new'>('new');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const hasUser = !!getActiveUserId();
  const { isBlocked } = useAuth();

  const loadReplies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReplies(postingId, sort);
      // Hide replies from blocked authors instantly (server also filters on load).
      setReplies((data.replies || []).filter((r) => !isBlocked(r.author_id)));
      if (data.posting) {
        onPostingTally?.(data.posting);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load replies');
    } finally {
      setLoading(false);
    }
  }, [postingId, sort, onPostingTally, isBlocked]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleSubmit = async () => {
    const body = text.trim();
    if (!body || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const newReply = await postReply(postingId, body);
      setText('');
      setReplies((prev) => [newReply, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prevReplies = replies;
    setReplies((cur) => cur.filter((r) => r.id !== id));
    try {
      await deleteReply(postingId, id);
    } catch (e) {
      setReplies(prevReplies);
      Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleHide = (id: string) => {
    setReplies((cur) => cur.filter((r) => r.id !== id));
  };

  const renderReply = ({ item }: { item: ReplyCardData }) => (
    <ReplyItem reply={item} onDelete={handleDelete} onHide={handleHide} />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.secondary} />
          <Text style={styles.title}>
            Replies <Text style={styles.count}>({replies.length})</Text>
          </Text>
        </View>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            onPress={() => setSort('top')}
            style={[styles.sortButton, sort === 'top' && styles.sortButtonActive]}
          >
            <Text style={[styles.sortText, sort === 'top' && styles.sortTextActive]}>Top</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSort('new')}
            style={[styles.sortButton, sort === 'new' && styles.sortButtonActive]}
          >
            <Text style={[styles.sortText, sort === 'new' && styles.sortTextActive]}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Composer */}
      {hasUser ? (
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Share your experience or ask a question…"
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            maxLength={5000}
            style={styles.input}
          />
          <View style={styles.composerFooter}>
            <Text style={styles.charCount}>{text.length}/5000</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!text.trim() || submitting}
              style={[styles.submitButton, (!text.trim() || submitting) && styles.submitDisabled]}
            >
              <Text style={styles.submitText}>
                {submitting ? 'Posting…' : 'Post reply'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noUserCard}>
          <Text style={styles.noUserText}>
            Select a user in onboarding to reply and vote.
          </Text>
        </View>
      )}

      {/* Error */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Replies list */}
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      ) : replies.length === 0 ? (
        <Text style={styles.emptyText}>No replies yet - be the first to share.</Text>
      ) : (
        <FlatList
          data={replies}
          renderItem={renderReply}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  count: {
    color: colors.onSurfaceVariant,
    fontWeight: '400',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  sortButtonActive: {
    backgroundColor: colors.primaryContainer,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  sortTextActive: {
    color: colors.onPrimaryContainer,
  },
  composer: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  charCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.default,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onPrimary,
  },
  noUserCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noUserText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  error: {
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  loader: {
    marginVertical: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
});

export default Replies;
