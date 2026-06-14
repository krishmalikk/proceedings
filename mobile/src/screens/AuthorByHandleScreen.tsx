import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { colors, spacing, borderRadius } from '../constants/theme';
import { getPostingsByHandle, AuthorPostingCard } from '../services/apiService';

type RouteParams = { AuthorByHandle: { handle: string } };

/**
 * Postings authored under a first-party (anonymous) handle. Reached from a
 * posting's Author card. Mirrors the website /author-by-handle/[handle] page.
 */
export function AuthorByHandleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'AuthorByHandle'>>();
  const handle = route.params?.handle || '';

  const [postings, setPostings] = useState<AuthorPostingCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getPostingsByHandle(handle)
      .then(setPostings)
      .finally(() => setLoading(false));
  }, [handle]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Author</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Ionicons name="person-circle" size={32} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>AUTHOR</Text>
            <Text style={styles.handle}>{handle || 'Author'}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          An anonymous community handle. These are the postings shared under it.
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>
              Postings by {handle} ({postings.length})
            </Text>
            {postings.length === 0 ? (
              <Text style={styles.muted}>No postings found for this author.</Text>
            ) : (
              postings.map((p) => (
                <TouchableOpacity
                  key={p.case_id}
                  style={styles.postingItem}
                  onPress={() => navigation.push('CaseDetails', { caseId: p.case_id })}
                >
                  <Text style={styles.postingTitle} numberOfLines={2}>
                    {p.title || p.case_id}
                  </Text>
                  <View style={styles.postingMeta}>
                    {p.visa.slice(0, 3).map((v) => (
                      <View key={v} style={[styles.chip, styles.chipPrimary]}>
                        <Text style={[styles.chipText, styles.chipTextPrimary]}>{v}</Text>
                      </View>
                    ))}
                    {p.consulates.slice(0, 2).map((c) => (
                      <View key={c} style={[styles.chip, styles.chipSecondary]}>
                        <Text style={[styles.chipText, styles.chipTextSecondary]}>{c}</Text>
                      </View>
                    ))}
                    {!!p.outcome && (
                      <View style={[styles.chip, styles.chipSecondary]}>
                        <Text style={[styles.chipText, styles.chipTextSecondary]}>{p.outcome}</Text>
                      </View>
                    )}
                    {!!p.date && <Text style={styles.postingDate}>{p.date}</Text>}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  content: { flex: 1, paddingHorizontal: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.base },
  overline: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.onSurfaceVariant },
  handle: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
  card: { marginTop: spacing.md, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  muted: { fontSize: 14, color: colors.onSurfaceVariant },
  postingItem: {
    gap: 4,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  postingTitle: { fontSize: 14, color: colors.onSurface },
  postingMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  chip: { borderRadius: borderRadius.full, paddingVertical: 3, paddingHorizontal: 9 },
  chipPrimary: { backgroundColor: colors.primaryContainer },
  chipSecondary: { backgroundColor: colors.secondaryContainer },
  chipText: { fontSize: 11, fontWeight: '500' },
  chipTextPrimary: { color: colors.onPrimaryContainer },
  chipTextSecondary: { color: colors.onSecondaryContainer },
  postingDate: { fontSize: 11, color: colors.onSurfaceVariant },
});

export default AuthorByHandleScreen;
