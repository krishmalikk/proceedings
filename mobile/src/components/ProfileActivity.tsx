import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colors, spacing, borderRadius } from '../constants/theme';
import {
  getUserPostings,
  getUserReplies,
  getAllGroups,
  AuthorPostingCard,
  UserReplyCard,
  GroupInfo,
} from '../services/apiService';

function Section({
  icon, title, count, empty, children,
}: { icon: keyof typeof Ionicons.glyphMap; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name={icon} size={18} color={colors.secondary} />
        <Text style={styles.title}>{title}</Text>
        {count > 0 && <Text style={styles.count}>({count})</Text>}
      </View>
      {count === 0 ? <Text style={styles.empty}>{empty}</Text> : <View style={styles.list}>{children}</View>}
    </Card>
  );
}

/**
 * The logged-in user's own activity on the portal: their postings, their
 * replies, and the groups they belong to. Shown on the Profile screen.
 */
export function ProfileActivity({
  uid,
  onOpenPosting,
  onOpenGroup,
}: {
  uid: string;
  onOpenPosting: (caseId: string) => void;
  onOpenGroup: (groupId: string, name: string) => void;
}) {
  const [postings, setPostings] = useState<AuthorPostingCard[]>([]);
  const [replies, setReplies] = useState<UserReplyCard[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);

  useEffect(() => {
    if (!uid) return;
    getUserPostings(uid).then(setPostings).catch(() => {});
    getUserReplies(uid).then(setReplies).catch(() => {});
    getAllGroups()
      .then((d) => setGroups((d.groups || []).filter((g) => g.is_member)))
      .catch(() => {});
  }, [uid]);

  return (
    <View>
      {/* 1) Your postings */}
      <Section icon="document-text-outline" title="Your Postings" count={postings.length} empty="You haven't posted anything yet.">
        {postings.map((p) => (
          <TouchableOpacity key={p.case_id} style={styles.item} onPress={() => onOpenPosting(p.case_id)}>
            <Text style={styles.itemTitle} numberOfLines={2}>{p.title || p.case_id}</Text>
            <View style={styles.metaRow}>
              {p.visa.slice(0, 3).map((v) => (
                <View key={v} style={[styles.chip, styles.chipPrimary]}>
                  <Text style={styles.chipTextPrimary}>{v}</Text>
                </View>
              ))}
              {!!p.outcome && (
                <View style={[styles.chip, styles.chipSecondary]}>
                  <Text style={styles.chipTextSecondary}>{p.outcome}</Text>
                </View>
              )}
              {!!p.date && <Text style={styles.meta}>{p.date}</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </Section>

      {/* 2) Your activity — replies */}
      <Section icon="chatbubbles-outline" title="Your Activity" count={replies.length} empty="You haven't replied to any postings yet.">
        {replies.map((r) => (
          <TouchableOpacity key={r.id} style={styles.item} onPress={() => onOpenPosting(r.parent_case_id)}>
            <Text style={styles.itemTitle} numberOfLines={2}>{r.body}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="arrow-undo-outline" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.meta}>replied on a posting{r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ''}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Section>

      {/* 3) Your groups */}
      <Section icon="people-outline" title="Your Groups" count={groups.length} empty="You're not part of any group yet.">
        {groups.map((g) => (
          <TouchableOpacity key={g.group_id} style={styles.item} onPress={() => onOpenGroup(g.group_id, g.name)}>
            <Text style={styles.itemTitle}>{g.name || 'Group'}</Text>
            <Text style={styles.meta}>
              {g.members.length} member{g.members.length === 1 ? '' : 's'}
              {g.criteria_text ? ` · ${g.criteria_text}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, padding: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.base },
  title: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  count: { fontSize: 13, color: colors.onSurfaceVariant },
  empty: { fontSize: 13, color: colors.onSurfaceVariant },
  list: { gap: spacing.md },
  item: { gap: 4 },
  itemTitle: { fontSize: 14, color: colors.onSurface },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  meta: { fontSize: 11, color: colors.onSurfaceVariant },
  chip: { borderRadius: borderRadius.full, paddingVertical: 2, paddingHorizontal: 8 },
  chipPrimary: { backgroundColor: colors.primaryContainer },
  chipTextPrimary: { fontSize: 11, color: colors.onPrimaryContainer, fontWeight: '500' },
  chipSecondary: { backgroundColor: colors.secondaryContainer },
  chipTextSecondary: { fontSize: 11, color: colors.onSecondaryContainer, fontWeight: '500' },
});

export default ProfileActivity;
