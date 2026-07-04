import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Markdown, AnimatedPressable } from '../components';
import { AuthorCard } from '../components/AuthorCard';
import { VoteControl } from '../components/VoteControl';
import { Replies } from '../components/Replies';
import { ContentActionsMenu } from '../components/ContentActionsMenu';
import { ScreenHeader } from '../components/ScreenHeader';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { getPosting, PostingData } from '../services/apiService';

type Tally = { up: number; down: number; score: number; your_vote: number };
const ZERO_TALLY: Tally = { up: 0, down: 0, score: 0, your_vote: 0 };

// Flip on when the verified-attorney guidance feature actually ships.
const ATTORNEY_GUIDANCE_TEASER = false;

function outcomeBadgeStyle(outcome: string) {
  const o = outcome.toLowerCase();
  if (o === 'approved' || o === 'issued') {
    return { backgroundColor: colors.secondaryContainer, color: colors.onSecondaryContainer };
  }
  return { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurfaceVariant };
}

export function CaseDetailsScreen({ navigation, route }: any) {
  const caseId: string = route?.params?.caseId || '';
  const [data, setData] = useState<PostingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [postingTally, setPostingTally] = useState<Tally>(ZERO_TALLY);

  const load = useCallback(() => {
    if (!caseId) {
      setError('No posting selected.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    getPosting(caseId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load posting'))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const onPostingTally = useCallback((t: Tally) => setPostingTally(t), []);

  // Same gating as the website: only show the source link for genuine Reddit posts.
  const isReddit =
    !!data?.url && (data.channel === 'reddit' || !!data.subreddit || /reddit\.com/i.test(data.url));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Case Details"
        onBack={() => navigation.goBack()}
        rightAction={
          data && !isReddit ? (
            <ContentActionsMenu
              contentId={data.case_id}
              contentType="posting"
              authorId={data.author_id}
              authorHandle={data.author_handle}
              onActioned={() => navigation.goBack()}
              color={colors.onSurface}
            />
          ) : undefined
        }
      />

      {loading && (
        <View style={styles.skeletonWrap}>
          <Skeleton.Card count={2} />
        </View>
      )}
      {!!error && !loading && <ErrorState body={error} onRetry={load} />}

      {data && !loading && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Vote rail + title block (website layout) */}
          <View style={styles.titleRow}>
            <VoteControl
              contentId={data.case_id}
              score={postingTally.score}
              yourVote={postingTally.your_vote}
            />
            <View style={styles.titleBlock}>
              <View style={styles.badgesRow}>
                {!!data.outcome && (
                  <View style={[styles.badge, { backgroundColor: outcomeBadgeStyle(data.outcome).backgroundColor }]}>
                    <Text style={[styles.badgeText, { color: outcomeBadgeStyle(data.outcome).color }]}>
                      {data.outcome}
                    </Text>
                  </View>
                )}
                {data.visa.map((v) => (
                  <View key={v} style={[styles.badge, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[styles.badgeText, { color: colors.onPrimaryContainer }]}>{v}</Text>
                  </View>
                ))}
                {data.consulates.map((c) => (
                  <View key={c} style={[styles.badge, styles.locationBadge]}>
                    <Ionicons name="location-outline" size={12} color={colors.onSecondaryContainer} />
                    <Text style={[styles.badgeText, { color: colors.onSecondaryContainer }]}>{c}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.title}>{data.title}</Text>
              {!!data.description && <Text style={styles.description}>{data.description}</Text>}
            </View>
          </View>

          {/* Full posting body */}
          <Card style={styles.bodyCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.secondary} />
              <Text style={styles.cardTitle}>Full Experience</Text>
            </View>
            {data.body ? (
              <Markdown>{data.body}</Markdown>
            ) : (
              <Text style={styles.bodyText}>No content available.</Text>
            )}
          </Card>

          {/* Details (website sidebar tile, inlined for mobile) */}
          <Card style={styles.bodyCard}>
            <Text style={styles.cardTitle}>Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Source</Text>
              <Text style={styles.detailValue}>
                {data.subreddit ? `r/${data.subreddit}` : data.channel}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Posted</Text>
              <Text style={styles.detailValue}>{data.date || '-'}</Text>
            </View>
            {!!data.outcome && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Outcome</Text>
                <Text style={styles.detailValue}>{data.outcome}</Text>
              </View>
            )}
          </Card>

          {/* Tags - every category as its own labeled section (website parity).
              Falls back to the flat `tags` list under "Topics" for older data. */}
          {(() => {
            const sections =
              data.tag_sections && data.tag_sections.length > 0
                ? data.tag_sections
                : data.tags.length > 0
                  ? [{ label: 'Topics', tags: data.tags }]
                  : [];
            if (sections.length === 0) return null;
            return (
              <Card style={styles.bodyCard}>
                <Text style={styles.cardTitle}>Tags</Text>
                {sections.map((sec) => (
                  <View key={sec.label} style={styles.tagSection}>
                    <Text style={styles.tagSectionLabel}>{sec.label}</Text>
                    <View style={styles.topicsWrap}>
                      {sec.tags.map((t) => (
                        <View key={t} style={styles.topicChip}>
                          <Text style={styles.topicText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </Card>
            );
          })()}

          {/* Author. A real in-app author (uid) gets the rich profile card;
              otherwise a first-party posting links its handle to the
              author-by-handle screen. External postings show nothing. */}
          {data.author_id ? (
            <AuthorCard
              authorId={data.author_id}
              channel={data.channel}
              currentCaseId={data.case_id}
              onOpenPosting={(cid) => navigation.push('CaseDetails', { caseId: cid })}
              onOpenAuthor={(uid) => navigation.navigate('Author', { uid })}
            />
          ) : data.author_handle ? (
            <Card style={styles.bodyCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle-outline" size={20} color={colors.secondary} />
                <Text style={styles.cardTitle}>Author</Text>
              </View>
              <TouchableOpacity
                style={styles.authorHandleRow}
                onPress={() => navigation.navigate('AuthorByHandle', { handle: data.author_handle })}
              >
                <Text style={styles.authorHandleText}>{data.author_handle}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.authorHandleHint}>See all postings by this author</Text>
            </Card>
          ) : null}

          {/* Source link - only for genuine Reddit-sourced posts (website parity) */}
          {isReddit && (
            <TouchableOpacity style={styles.redditLink} onPress={() => Linking.openURL(data.url)}>
              <Ionicons name="open-outline" size={18} color={colors.secondary} />
              <Text style={styles.redditLinkText}>View original on Reddit</Text>
            </TouchableOpacity>
          )}

          {/* Attorney-guidance teaser — flag-gated OFF until the feature ships;
              a permanent "Coming Soon" box read as unfinished on every posting. */}
          {ATTORNEY_GUIDANCE_TEASER && (
            <Card style={styles.comingSoon}>
              <Text style={styles.comingSoonTitle}>Coming Soon</Text>
              <Text style={styles.comingSoonText}>
                Personalized guidance from a verified immigration attorney is coming soon.
              </Text>
            </Card>
          )}

          {/* Replies - same component as the rest of the app */}
          <View style={styles.repliesWrap}>
            <Replies postingId={data.case_id} onPostingTally={onPostingTally} />
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  skeletonWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  content: { flex: 1, paddingHorizontal: spacing.md },
  titleRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.base },
  titleBlock: { flex: 1, minWidth: 0 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.base },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: borderRadius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  locationBadge: { backgroundColor: colors.secondaryContainer },
  badgeText: { fontSize: 12, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.base },
  description: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20 },
  bodyCard: { marginTop: spacing.md, padding: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.base },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface, marginBottom: spacing.base },
  bodyText: { fontSize: 14, color: colors.onSurface, lineHeight: 21 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  detailKey: { fontSize: 13, color: colors.onSurfaceVariant },
  detailValue: { fontSize: 13, color: colors.onSurface, fontWeight: '500' },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topicChip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  topicText: { fontSize: 12, color: colors.onSurfaceVariant },
  tagSection: { marginBottom: spacing.base },
  tagSectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  authorHandleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorHandleText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  authorHandleHint: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  redditLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  redditLinkText: { color: colors.secondary, fontSize: 14, fontWeight: '500' },
  comingSoon: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
  },
  comingSoonTitle: { fontSize: 16, fontWeight: '700', color: colors.onPrimaryContainer },
  comingSoonText: {
    fontSize: 13,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
  repliesWrap: { marginTop: spacing.lg },
});

export default CaseDetailsScreen;
