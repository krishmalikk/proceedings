import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Header,
  PostingCard,
  Skeleton,
  EmptyState,
  ErrorState,
  AnimatedListItem,
  FilterChip,
  TagPicker,
  AppText,
} from '../components';
import { colors, spacing, borderRadius } from '../constants/theme';
import {
  searchPostings,
  fetchQueryTags,
  getTagVocab,
  facetId,
  SearchResultItem,
  TagVocab,
  Strictness,
} from '../services/apiService';

type TagField = 'current_visa_or_greencard_category' | 'visa_applying_for' | 'consulates' | 'tags';
type Tag = { field: TagField; code: string; label: string };

const CATEGORY_FIELDS: { field: TagField; label: string; kind: 'visa' | 'consulate' | 'tag' }[] = [
  { field: 'current_visa_or_greencard_category', label: 'Current status', kind: 'visa' },
  { field: 'visa_applying_for', label: 'Applying for', kind: 'visa' },
  { field: 'consulates', label: 'Consulate(s)', kind: 'consulate' },
  { field: 'tags', label: 'Tags', kind: 'tag' },
];

const STRICTNESS_LEVELS: { value: Strictness; label: string }[] = [
  { value: 'broad', label: 'Broad' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'strict', label: 'Strict' },
];

const TAB_BAR_CLEARANCE = 96;

export function AdvancedSearchScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [freeText, setFreeText] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [strictness, setStrictness] = useState<Strictness>('balanced');
  const [revealedFields, setRevealedFields] = useState<Set<TagField>>(new Set());
  const [vocab, setVocab] = useState<TagVocab | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    getTagVocab().then(setVocab).catch(() => {});
  }, []);

  const consulateByLabel = useMemo(
    () => new Map((vocab?.consulate_options || []).map((o) => [o.label, o.code])),
    [vocab]
  );
  const consulateByCode = useMemo(
    () => new Map((vocab?.consulate_options || []).map((o) => [o.code, o.label])),
    [vocab]
  );

  function tagsFor(field: TagField): Tag[] {
    return tags.filter((t) => t.field === field);
  }
  function isShown(field: TagField): boolean {
    return revealedFields.has(field) || tags.some((t) => t.field === field);
  }
  function reveal(field: TagField) {
    setRevealedFields((prev) => new Set(prev).add(field));
  }
  // A category that's ever held a tag (generated or manual) stays visible
  // even after its last tag is removed — avoids layout/focus jumping while
  // the user is actively editing it.
  function addTag(field: TagField, code: string) {
    reveal(field);
    setTags((prev) => (prev.some((t) => t.field === field && t.code === code) ? prev : [...prev, { field, code, label: code }]));
  }
  function removeTag(field: TagField, code: string) {
    setTags((prev) => prev.filter((t) => !(t.field === field && t.code === code)));
  }

  // "Send" — generate tags from free text (additive: never drops what's
  // already on screen, including manually-added tags or a prior Send).
  async function send() {
    const t = freeText.trim();
    if (!t || generating) return;
    setGenerating(true);
    setError('');
    try {
      const generated = await fetchQueryTags(t);
      setRevealedFields((prev) => {
        const next = new Set(prev);
        for (const g of generated) next.add(g.field as TagField);
        return next;
      });
      setTags((prev) => {
        const next = [...prev];
        for (const g of generated) {
          const field = g.field as TagField;
          if (!next.some((t2) => t2.field === field && t2.code === g.code)) {
            next.push({ field, code: g.code, label: g.label });
          }
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate tags');
    } finally {
      setGenerating(false);
    }
  }

  // "Search" — same /api/search mechanism as Home search; results render
  // inline on this screen (no navigation).
  async function runSearch(pageToken: string) {
    if (pageToken) setLoadingMore(true);
    else setSearchLoading(true);
    setError('');
    try {
      const facets = tags.map((t) => facetId(t.field, t.code));
      const data = await searchPostings(freeText, { facets, pageToken, strictness });
      setResults((prev) => (pageToken ? [...prev, ...data.results] : data.results));
      setNextPageToken(data.next_page_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearchLoading(false);
      setLoadingMore(false);
      setSearched(true);
    }
  }

  function loadMore() {
    if (!nextPageToken || loadingMore) return;
    runSearch(nextPageToken);
  }

  return (
    <View style={styles.container}>
      <Header showLogo={false} transparent title="Advanced Search" showBack onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="labelMd" color="onSurface" style={styles.sectionLabel}>
          Describe what you&apos;re looking for
        </AppText>
        <TextInput
          style={styles.textArea}
          value={freeText}
          onChangeText={setFreeText}
          placeholder="e.g. H-1B RFE experiences at the Mumbai consulate…"
          placeholderTextColor={colors.onSurfaceVariant}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity style={styles.sendButton} onPress={send} disabled={generating || !freeText.trim()}>
          <AppText variant="labelMd" color="onPrimary">{generating ? 'Generating…' : 'Send'}</AppText>
        </TouchableOpacity>

        <AppText variant="labelMd" color="onSurface" style={[styles.sectionLabel, styles.tagsHeading]}>
          Search tags
        </AppText>
        {tags.length === 0 && revealedFields.size === 0 && (
          <AppText variant="bodyMd" color="onSurfaceVariant" style={styles.hint}>
            Tap Send to generate tags from your text, or add one manually below.
          </AppText>
        )}

        {CATEGORY_FIELDS.filter((c) => isShown(c.field)).map((c) => {
          const values = tagsFor(c.field);
          const options =
            c.kind === 'visa' ? vocab?.visa || []
              : c.kind === 'consulate' ? (vocab?.consulate_options || []).map((o) => o.label)
                : vocab?.tag || [];
          return (
            <View key={c.field} style={styles.category}>
              <AppText variant="caption" color="onSurfaceVariant" style={styles.categoryLabel}>
                {c.label.toUpperCase()}
              </AppText>
              <View style={styles.chipRow}>
                {values.length === 0 && (
                  <AppText variant="caption" color="onSurfaceVariant">None.</AppText>
                )}
                {values.map((t) => (
                  <FilterChip
                    key={t.code}
                    label={c.kind === 'consulate' ? consulateByCode.get(t.code) || t.code : t.code}
                    selected
                    onPress={() => removeTag(c.field, t.code)}
                  />
                ))}
              </View>
              <TagPicker
                placeholder={c.kind === 'consulate' ? 'Add a consulate…' : `Add ${c.label.toLowerCase()}…`}
                options={options}
                onPick={(picked) => {
                  const code = c.kind === 'consulate' ? consulateByLabel.get(picked) || picked : picked;
                  addTag(c.field, code);
                }}
              />
            </View>
          );
        })}

        {CATEGORY_FIELDS.filter((c) => !isShown(c.field)).length > 0 && (
          <View style={styles.chipRow}>
            {CATEGORY_FIELDS.filter((c) => !isShown(c.field)).map((c) => (
              <FilterChip key={c.field} label={`+ Add ${c.label}`} onPress={() => reveal(c.field)} />
            ))}
          </View>
        )}

        <View style={styles.strictnessRow}>
          <AppText variant="labelMd" color="onSurfaceVariant">Precision</AppText>
          <View style={styles.segmented}>
            {STRICTNESS_LEVELS.map((l) => (
              <TouchableOpacity
                key={l.value}
                style={[styles.segment, strictness === l.value && styles.segmentActive]}
                onPress={() => setStrictness(l.value)}
              >
                <AppText variant="caption" color={strictness === l.value ? 'onPrimary' : 'onSurfaceVariant'}>
                  {l.label}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={() => runSearch('')} disabled={searchLoading}>
          <AppText variant="labelMd" color="onPrimary">{searchLoading ? 'Searching…' : 'Search'}</AppText>
        </TouchableOpacity>

        {error ? <ErrorState body={error} onRetry={() => runSearch('')} /> : null}

        {searchLoading && <Skeleton.Card count={4} style={styles.results} />}

        {searched && !searchLoading && (
          results.length === 0 && !error ? (
            <EmptyState
              icon="search-outline"
              title="No results"
              body="No postings matched your tags — try removing one or broadening your text."
            />
          ) : (
            <View style={styles.results}>
              {results.map((r, index) => (
                <AnimatedListItem key={r.case_id} index={Math.min(index, 6)} staggerDelay={60}>
                  <PostingCard
                    posting={r}
                    authorId={r.author_id}
                    onPress={() => navigation.navigate('CaseDetails', { caseId: r.case_id })}
                  />
                </AnimatedListItem>
              ))}
              {nextPageToken ? (
                <TouchableOpacity style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
                  <AppText variant="labelMd" color="onSurface">{loadingMore ? 'Loading…' : 'Load more'}</AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.md },
  sectionLabel: { marginTop: spacing.md, marginBottom: spacing.sm },
  textArea: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.default,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.onSurface,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  tagsHeading: { marginTop: spacing.lg },
  hint: { marginBottom: spacing.sm },
  category: { marginBottom: spacing.md },
  categoryLabel: { marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  strictnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    padding: 3,
  },
  segment: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: borderRadius.full },
  segmentActive: { backgroundColor: colors.primary },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  results: { marginTop: spacing.md },
  loadMore: {
    alignSelf: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    marginTop: spacing.base,
  },
});

export default AdvancedSearchScreen;
