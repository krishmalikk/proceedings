import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import Markdown from './Markdown';
import { colors, spacing, borderRadius } from '../constants/theme';
import {
  getPublicProfile,
  getUserPostings,
  getTagVocab,
  PublicProfile,
  AuthorPostingCard,
} from '../services/apiService';

const has = (a?: unknown[]) => Array.isArray(a) && a.length > 0;
const hasObj = (o?: Record<string, string>) => !!o && Object.keys(o).length > 0;
const prettyKey = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Chips({ items, variant = 'primary' }: { items: string[]; variant?: 'primary' | 'secondary' | 'plain' }) {
  return (
    <View style={styles.chipsWrap}>
      {items.map((v) => (
        <View
          key={v}
          style={[
            styles.chip,
            variant === 'primary' && styles.chipPrimary,
            variant === 'secondary' && styles.chipSecondary,
            variant === 'plain' && styles.chipPlain,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              variant === 'primary' && styles.chipTextPrimary,
              variant === 'secondary' && styles.chipTextSecondary,
            ]}
          >
            {v}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A posting author's structured profile + their other postings (mirrors the
 * website AuthorSection). Renders nothing for non-app postings; an "Anonymous
 * author" note when an app posting has no known author.
 */
export function AuthorCard({
  authorId,
  channel,
  currentCaseId,
  full = false,
  onOpenPosting,
  onOpenAuthor,
}: {
  authorId: string;
  channel: string;
  currentCaseId?: string;
  full?: boolean;
  onOpenPosting: (caseId: string) => void;
  onOpenAuthor?: (uid: string) => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [postings, setPostings] = useState<AuthorPostingCard[]>([]);
  const [consLabel, setConsLabel] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([getPublicProfile(authorId), getUserPostings(authorId), getTagVocab()])
      .then(([prof, posts, vocab]) => {
        setProfile(prof);
        setPostings(posts);
        if (vocab?.consulate_options) {
          setConsLabel(Object.fromEntries(vocab.consulate_options.map((o) => [o.code, o.label])));
        }
      })
      .finally(() => setLoading(false));
  }, [authorId]);

  // Reddit / other-source postings have no app author - omit entirely.
  if (channel !== 'app') return null;

  if (!authorId) {
    return (
      <Card style={styles.card}>
        <Text style={styles.heading}>Author</Text>
        <View style={styles.anonRow}>
          <Ionicons name="person-outline" size={18} color={colors.onSurfaceVariant} />
          <Text style={styles.anonText}>Anonymous author</Text>
        </View>
      </Card>
    );
  }

  const consName = (code: string) => consLabel[code] || code;
  const other = postings.filter((p) => p.case_id !== currentCaseId);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="person-circle-outline" size={20} color={colors.secondary} />
          <Text style={styles.heading}>Author</Text>
        </View>
        {!!onOpenAuthor && (
          <TouchableOpacity onPress={() => onOpenAuthor(authorId)}>
            <Text style={styles.viewProfile}>View profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
      ) : !profile ? (
        <Text style={styles.muted}>This author hasn’t set up a profile yet.</Text>
      ) : (
        <View style={styles.body}>
          <Text style={styles.username}>{profile.username || 'Member'}</Text>

          {(has(profile.current_visa_or_greencard_category) || has(profile.visa_applying_for)) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Visa Status</Text>
              {has(profile.current_visa_or_greencard_category) && (
                <Chips items={profile.current_visa_or_greencard_category} variant="primary" />
              )}
              {has(profile.visa_applying_for) && <Chips items={profile.visa_applying_for} variant="secondary" />}
            </View>
          )}

          {has(profile.consulates) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Consulates</Text>
              <Chips items={profile.consulates.map(consName)} variant="secondary" />
            </View>
          )}

          {has(profile.tags) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags</Text>
              <Chips items={profile.tags} variant="plain" />
            </View>
          )}

          {hasObj(profile.key_stages_or_info) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key Stages</Text>
              {Object.entries(profile.key_stages_or_info).map(([k, v]) => (
                <Text key={k} style={styles.kv}>
                  {prettyKey(k)}: <Text style={styles.kvVal}>{v}</Text>
                </Text>
              ))}
            </View>
          )}

          {hasObj(profile.key_dates) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key Dates</Text>
              {Object.entries(profile.key_dates).map(([k, v]) => (
                <Text key={k} style={styles.kv}>
                  {prettyKey(k)}: <Text style={styles.kvVal}>{v}</Text>
                </Text>
              ))}
            </View>
          )}

          {full && !!profile.background_text && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Background</Text>
              <Markdown>{profile.background_text}</Markdown>
            </View>
          )}

          {full && has(profile.journey) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Journey</Text>
              {profile.journey.map((e, i) => (
                <Text key={i} style={styles.kv}>
                  {prettyKey(e.milestone)}
                  {e.date ? <Text style={styles.kvVal}> · {e.date}</Text> : null}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {other.length > 0 && (
        <View style={styles.postingsBlock}>
          <Text style={styles.sectionLabel}>
            {currentCaseId ? 'More postings by this author' : 'Postings'} ({other.length})
          </Text>
          {other.map((p) => (
            <TouchableOpacity key={p.case_id} style={styles.postingItem} onPress={() => onOpenPosting(p.case_id)}>
              <Text style={styles.postingTitle} numberOfLines={2}>
                {p.title || p.case_id}
              </Text>
              <View style={styles.postingMeta}>
                {p.visa.slice(0, 3).map((v) => (
                  <View key={v} style={[styles.chip, styles.chipPrimary]}>
                    <Text style={[styles.chipText, styles.chipTextPrimary]}>{v}</Text>
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
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, padding: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  viewProfile: { fontSize: 12, color: colors.secondary, fontWeight: '500' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  anonText: { fontSize: 14, color: colors.onSurfaceVariant },
  muted: { fontSize: 13, color: colors.onSurfaceVariant },
  body: { gap: spacing.base },
  username: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  section: { gap: 4 },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', color: colors.onSurfaceVariant, letterSpacing: 0.4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { borderRadius: borderRadius.full, paddingVertical: 3, paddingHorizontal: 9 },
  chipPrimary: { backgroundColor: colors.primaryContainer },
  chipSecondary: { backgroundColor: colors.secondaryContainer },
  chipPlain: { backgroundColor: colors.surfaceContainerHigh },
  chipText: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  chipTextPrimary: { color: colors.onPrimaryContainer },
  chipTextSecondary: { color: colors.onSecondaryContainer },
  kv: { fontSize: 13, color: colors.onSurface },
  kvVal: { color: colors.onSurfaceVariant },
  postingsBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    gap: spacing.base,
  },
  postingItem: { gap: 4 },
  postingTitle: { fontSize: 14, color: colors.onSurface },
  postingMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  postingDate: { fontSize: 11, color: colors.onSurfaceVariant },
});

export default AuthorCard;
