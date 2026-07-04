import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, PostingCard, Skeleton, EmptyState, ErrorState } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, borderRadius } from '../constants/theme';
import {
  searchPostings,
  facetId,
  SearchResultItem,
  SuggestedFilterGroup,
  Strictness,
} from '../services/apiService';

// Same example prompts as the website's empty search state.
const EXAMPLES = ['B1/B2 Mumbai', 'H-1B RFE', 'F-1 to H-1B'];

const STRICTNESS_LEVELS: { value: Strictness; label: string }[] = [
  { value: 'broad', label: 'Broad' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'strict', label: 'Strict' },
];

export function SearchScreen({ navigation }: any) {
  const { isBlocked } = useAuth();
  const [query, setQuery] = useState('');
  const [strictness, setStrictness] = useState<Strictness>('balanced');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [suggested, setSuggested] = useState<SuggestedFilterGroup[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const runSearch = useCallback(
    async (q: string, facets: Set<string>, level: Strictness) => {
      setLoading(true);
      setError('');
      try {
        const data = await searchPostings(q, {
          strictness: level,
          facets: Array.from(facets),
        });
        setResults(data.results);
        setNextPageToken(data.next_page_token);
        setSuggested(data.suggested_filters);
        setSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMore = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await searchPostings(query, {
        strictness,
        facets: Array.from(selectedFacets),
        pageToken: nextPageToken,
      });
      setResults((prev) => [...prev, ...data.results]);
      setNextPageToken(data.next_page_token);
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFacet = (field: string, code: string) => {
    const id = facetId(field, code);
    const next = new Set(selectedFacets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFacets(next);
    runSearch(query, next, strictness);
  };

  const changeStrictness = (level: Strictness) => {
    setStrictness(level);
    if (searched) runSearch(query, selectedFacets, level);
  };

  const submit = (q?: string) => {
    const text = (q ?? query).trim();
    if (q !== undefined) setQuery(q);
    setSelectedFacets(new Set());
    runSearch(text, new Set(), strictness);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Community"
        showLogo={false}
        transparent
        showProfile
        onProfile={() => navigation.navigate('Profile')}
        rightAction={
          <TouchableOpacity
            style={styles.postButton}
            onPress={() => navigation.navigate('Post')}
            accessibilityLabel="Post a new message"
          >
            <Ionicons name="create-outline" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Search box */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={colors.onSurfaceVariant} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search visa experiences…"
              placeholderTextColor={colors.onSurfaceVariant}
              returnKeyType="search"
              onSubmitEditing={() => submit()}
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={() => submit()} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Strictness — parity with the website's precision slider */}
        <View style={styles.strictnessRow}>
          <Text style={styles.strictnessLabel}>Precision</Text>
          <View style={styles.segmented}>
            {STRICTNESS_LEVELS.map((l) => (
              <TouchableOpacity
                key={l.value}
                style={[styles.segment, strictness === l.value && styles.segmentActive]}
                onPress={() => changeStrictness(l.value)}
              >
                <Text style={[styles.segmentText, strictness === l.value && styles.segmentTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Suggested filters from the search response (website parity) */}
        {suggested.length > 0 && (
          <View style={styles.filtersBlock}>
            <View style={styles.filtersHeader}>
              <Ionicons name="filter" size={16} color={colors.secondary} />
              <Text style={styles.filtersTitle}>Refine by</Text>
            </View>
            {suggested.map((g) => (
              <View key={g.key} style={styles.filterGroup}>
                <Text style={styles.filterGroupLabel}>{g.label}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {g.values.map((v) => {
                    const active = selectedFacets.has(facetId(g.field, v.code));
                    return (
                      <TouchableOpacity
                        key={v.code}
                        style={[styles.facetChip, active && styles.facetChipActive]}
                        onPress={() => toggleFacet(g.field, v.code)}
                      >
                        <Text style={[styles.facetChipText, active && styles.facetChipTextActive]}>
                          {v.label} ({v.count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </View>
        )}

        {error ? (
          <ErrorState body={error} onRetry={() => runSearch(query, selectedFacets, strictness)} />
        ) : null}

        {/* Loading — skeleton feed instead of a bare spinner */}
        {loading && <Skeleton.Card count={4} style={styles.results} />}

        {/* Empty state with example prompts (website parity) */}
        {!searched && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={40} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>Search real visa experiences</Text>
            <Text style={styles.emptyText}>
              Find postings from applicants in the same situation — by visa, consulate, or what happened.
            </Text>
            <View style={styles.exampleRow}>
              {EXAMPLES.map((ex) => (
                <TouchableOpacity key={ex} style={styles.exampleChip} onPress={() => submit(ex)}>
                  <Text style={styles.exampleChipText}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Results */}
        {searched && !loading && (() => {
          // Hide postings from blocked authors instantly (server also filters).
          const visible = results.filter((r) => !isBlocked(r.author_id));
          if (visible.length === 0 && !error) {
            return (
              <EmptyState
                icon="search-outline"
                title="No results"
                body="Try broadening your search or removing a filter."
              />
            );
          }
          return (
          <View style={styles.results}>
            <Text style={styles.resultsCount}>
              {`${visible.length} result${visible.length === 1 ? '' : 's'}`}
            </Text>
            {visible.map((r) => (
              <PostingCard
                key={r.case_id}
                posting={r}
                onPress={() => navigation.navigate('CaseDetails', { caseId: r.case_id })}
              />
            ))}
            {nextPageToken ? (
              <TouchableOpacity style={styles.loadMore} onPress={loadMore} disabled={loadingMore}>
                <Text style={styles.loadMoreText}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          );
        })()}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.md },
  searchRow: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.md },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.onSurface },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minWidth: 76,
    alignItems: 'center',
  },
  searchButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
  postButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  strictnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  strictnessLabel: { fontSize: 13, color: colors.onSurfaceVariant, fontWeight: '500' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    padding: 3,
  },
  segment: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: borderRadius.full },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.onPrimary, fontWeight: '600' },
  filtersBlock: { marginTop: spacing.md },
  filtersHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.base },
  filtersTitle: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  filterGroup: { marginBottom: spacing.base },
  filterGroupLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  facetChip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    marginRight: spacing.base,
  },
  facetChipActive: { backgroundColor: colors.primaryContainer },
  facetChipText: { fontSize: 12, color: colors.onSurfaceVariant },
  facetChipTextActive: { color: colors.onPrimaryContainer, fontWeight: '600' },
  error: { color: colors.error, marginTop: spacing.md },
  emptyState: { alignItems: 'center', marginTop: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.onSurface, marginTop: spacing.md },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.base,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  exampleChip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  exampleChipText: { fontSize: 13, color: colors.onSurface },
  results: { marginTop: spacing.md },
  resultsCount: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: spacing.base },
  loadMore: {
    alignSelf: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    marginTop: spacing.base,
  },
  loadMoreText: { fontSize: 14, color: colors.onSurface, fontWeight: '500' },
});

export default SearchScreen;
