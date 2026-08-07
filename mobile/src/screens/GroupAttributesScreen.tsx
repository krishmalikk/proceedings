import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../constants/theme';
import { AppText, Skeleton, EmptyState, ErrorState } from '../components';
import {
  PostJoinAttributeRow,
  getGroup,
  getMemberAttributes,
  getTagVocab,
  GroupInfo,
  MemberAttributes,
} from '../services/apiService';

type RouteParams = {
  GroupAttributes: { groupId: string; groupName?: string };
};

// Two-line headers let each column be narrower, so more attributes fit
// before the row needs scrolling — the whole point of this screen.
const COL_WIDTH = 96;
const HEADER_LINES = 2;

/**
 * Every member's submitted attributes for one group, side by side — the wide
 * view the group screen's narrow member rows can't give, and the mobile
 * counterpart of the website's /groups/[id]/members table page.
 *
 * React Native has no <table>, so this is the divider-row list idiom inside a
 * horizontal ScrollView: one fixed-width column per template row, so columns
 * stay aligned between the header and every member row.
 */
export function GroupAttributesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'GroupAttributes'>>();
  const { groupId, groupName } = route.params;

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [attrs, setAttrs] = useState<MemberAttributes[]>([]);
  const [rows, setRows] = useState<PostJoinAttributeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getGroup(groupId),
      getMemberAttributes(groupId).catch(() => ({ attributes: [] as MemberAttributes[] })),
      getTagVocab().catch(() => null),
    ])
      .then(([g, a, v]) => {
        if (cancelled) return;
        setGroup(g);
        setAttrs(a.attributes || []);
        // Same matched-template lookup as GroupChatScreen and the backend's
        // _matched_post_join_type() — the columns ARE the template.
        const templates = v?.post_join_attribute_templates || {};
        const c = g.criteria_tags;
        const candidates =
          g.group_type === 'timeline' && c
            ? [...(c.tags || []), ...(c.current_visa_or_greencard_category || [])]
            : [];
        const matched = candidates.find((t) => t in templates) || '';
        setRows(matched ? templates[matched] || [] : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load attributes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const byUser: Record<string, MemberAttributes> = {};
  attrs.forEach((a) => {
    byUser[a.user_id] = a;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <AppText variant="titleMd" color="onSurface" style={styles.headerTitle} numberOfLines={1}>
          {group?.name || groupName || 'Attributes'}
        </AppText>
      </View>

      {loading ? (
        <View style={styles.body}>
          <Skeleton style={styles.skeletonRow} />
          <Skeleton style={styles.skeletonRow} />
          <Skeleton style={styles.skeletonRow} />
        </View>
      ) : error ? (
        <ErrorState body={error} />
      ) : !group?.is_member ? (
        <EmptyState icon="lock-closed-outline" title="Members only" body="Only members can see this." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing to compare"
          body="This group doesn't collect timeline attributes."
        />
      ) : (
        <ScrollView horizontal>
          <ScrollView>
            <View style={styles.headerRow}>
              <AppText variant="caption" color="onSurfaceVariant" style={styles.memberCol} numberOfLines={HEADER_LINES}>
                MEMBER
              </AppText>
              {rows.map((r) => (
                <AppText
                  key={r.key}
                  variant="caption"
                  color="onSurfaceVariant"
                  style={styles.headerCell}
                  numberOfLines={HEADER_LINES}
                >
                  {r.label.toUpperCase()}
                </AppText>
              ))}
              <AppText variant="caption" color="onSurfaceVariant" style={styles.headerCell} numberOfLines={HEADER_LINES}>
                NOTES
              </AppText>
            </View>
            {group.members.map((m) => {
              const a = byUser[m.user_id];
              return (
                <View key={m.user_id} style={styles.dataRow}>
                  <AppText variant="bodyMd" color="onSurface" style={styles.memberCol} numberOfLines={1}>
                    {m.username}
                  </AppText>
                  {rows.map((r) => (
                    r.kind === 'checkbox' ? (
                      <View key={r.key} style={styles.cell}>
                        {a?.values?.[r.key]
                          ? <Ionicons name="checkmark" size={18} color={colors.primary} />
                          : <AppText variant="bodyMd" color="onSurfaceVariant">—</AppText>}
                      </View>
                    ) : (
                      <AppText key={r.key} variant="bodyMd" color="onSurfaceVariant" style={styles.cell}>
                        {a?.values?.[r.key] || '—'}
                      </AppText>
                    )
                  ))}
                  <AppText variant="caption" color="onSurfaceVariant" style={styles.cell}>
                    {a?.notes || '—'}
                  </AppText>
                </View>
              );
            })}
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTitle: {
    flex: 1,
  },
  body: {
    padding: spacing.md,
  },
  skeletonRow: {
    height: 24,
    marginBottom: spacing.sm,
  },
  headerCell: {
    width: COL_WIDTH,
    paddingRight: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  dataRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  memberCol: {
    width: COL_WIDTH,
    paddingRight: spacing.sm,
  },
  cell: {
    width: COL_WIDTH,
    paddingRight: spacing.sm,
  },
});

export default GroupAttributesScreen;
