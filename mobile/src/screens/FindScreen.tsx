import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius } from '../constants/theme';
import { MatchCard, Card } from '../components';
import {
  getUsers,
  getTagVocab,
  findChat,
  findMatches,
  getAllGroups,
  createGroup,
  joinGroup,
  getActiveUserId,
  setActiveUserId,
  loadActiveUser,
  SeedUser,
  TagVocab,
  MatchData,
  Criteria,
  GroupInfo,
} from '../services/apiService';

type Turn = { id: string; role: 'user' | 'ai'; content: string };

const EMPTY_CRITERIA: Criteria = {
  current_visa_or_greencard_category: [],
  visa_applying_for: [],
  primary_consulate: '',
  consulates: [],
  key_stages_or_info: {},
  key_dates: {},
  background_text: '',
};

const GREETING =
  "Hi! I'll help you find others **in the same boat** — applicants in a similar immigration situation. " +
  "Tell me about your situation: your current status (or what you're applying for), the consulate involved, " +
  "and the key dates that place you in line. I'll turn it into match criteria.";

function hasCriteria(c: Criteria): boolean {
  return (
    c.current_visa_or_greencard_category.length > 0 ||
    c.visa_applying_for.length > 0 ||
    c.consulates.length > 0 ||
    Object.keys(c.key_stages_or_info).length > 0 ||
    Object.keys(c.key_dates).length > 0
  );
}

export function FindScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [tab, setTab] = useState<'find' | 'browse'>('browse');
  const [users, setUsers] = useState<SeedUser[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<Criteria>(EMPTY_CRITERIA);
  const [vocab, setVocab] = useState<TagVocab | null>(null);
  const [messages, setMessages] = useState<Turn[]>([{ id: 'greet', role: 'ai', content: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Matches
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [searched, setSearched] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Browse
  const [allGroups, setAllGroups] = useState<GroupInfo[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Load users and vocab on mount
  useEffect(() => {
    async function init() {
      await loadActiveUser();
      const id = getActiveUserId();
      if (id) setActiveId(id);

      try {
        const [userList, vocabData] = await Promise.all([getUsers(), getTagVocab()]);
        setUsers(userList);
        setVocab(vocabData);
        if (!id && userList.length > 0) {
          setActiveUserId(userList[0].id);
          setActiveId(userList[0].id);
        }
      } catch {
        // Ignore init errors
      }
    }
    init();
  }, []);

  // Load groups when on browse tab
  const loadGroups = useCallback(async () => {
    if (!activeId) return;
    setBrowseLoading(true);
    setError('');
    try {
      const data = await getAllGroups();
      setAllGroups(data.groups || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load groups');
    } finally {
      setBrowseLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    if (tab === 'browse' && activeId) {
      loadGroups();
    }
  }, [tab, activeId, loadGroups]);

  const switchUser = (id: string) => {
    setActiveUserId(id);
    setActiveId(id);
    setDraft(EMPTY_CRITERIA);
    setMessages([{ id: 'greet', role: 'ai', content: GREETING }]);
    setMatches([]);
    setSearched(false);
    setSelected(new Set());
  };

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    setInput('');
    setError('');

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', content: t }]);
    setLoading(true);

    try {
      const data = await findChat([...history, { role: 'user', content: t }], draft);
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: 'ai', content: data.reply }]);
      setDraft({ ...EMPTY_CRITERIA, ...data.criteria });
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-x`, role: 'ai', content: e instanceof Error ? e.message : 'Error' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const runMatches = async () => {
    setMatchLoading(true);
    setError('');
    try {
      const data = await findMatches(draft);
      setMatches(data.matches || []);
      setSearched(true);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not find matches');
    } finally {
      setMatchLoading(false);
    }
  };

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(userId) ? n.delete(userId) : n.add(userId);
      return n;
    });
  };

  const handleCreateGroup = async () => {
    const members = matches
      .filter((m) => selected.has(m.user_id))
      .map((m) => ({ user_id: m.user_id, username: m.username }));
    try {
      const result = await createGroup(draft.background_text || '', draft, members);
      if (result.group_id) {
        navigation.navigate('GroupChat', { groupId: result.group_id, groupName: result.name });
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create group');
    }
  };

  const handleJoinGroup = async (groupId: string, groupName: string) => {
    try {
      await joinGroup(groupId);
      await loadGroups();
      navigation.navigate('GroupChat', { groupId, groupName });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not join group');
    }
  };

  const removeChip = (field: keyof Criteria, value: string) => {
    setDraft((d) => ({
      ...d,
      [field]: (d[field] as string[]).filter((v) => v !== value),
    }));
  };

  const myGroups = allGroups.filter((g) => g.is_member);
  const otherGroups = allGroups.filter((g) => !g.is_member);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Find Your Group</Text>
          {users.length > 0 && (
            <View style={styles.userPicker}>
              <Ionicons name="person-circle-outline" size={20} color={colors.onSurfaceVariant} />
              <Text style={styles.userLabel}>{users.find((u) => u.id === activeId)?.username || 'Select'}</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setTab('browse')}
            style={[styles.tab, tab === 'browse' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'browse' && styles.tabTextActive]}>Groups</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('find')}
            style={[styles.tab, tab === 'find' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'find' && styles.tabTextActive]}>Find / Create</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {tab === 'browse' ? (
          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
            {browseLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
              <>
                <Text style={styles.sectionTitle}>Your Groups</Text>
                {myGroups.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Text style={styles.emptyText}>
                      You haven't joined any group yet. Create or find one!
                    </Text>
                  </Card>
                ) : (
                  myGroups.map((g) => (
                    <TouchableOpacity
                      key={g.group_id}
                      style={styles.groupCard}
                      onPress={() => navigation.navigate('GroupChat', { groupId: g.group_id, groupName: g.name })}
                    >
                      <View style={styles.groupHeader}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={styles.groupName}>{g.name}</Text>
                      </View>
                      {g.criteria_text ? <Text style={styles.groupCriteria}>{g.criteria_text}</Text> : null}
                      <Text style={styles.groupMembers}>
                        {g.members.length} member{g.members.length !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}

                {otherGroups.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Other Groups</Text>
                    {otherGroups.map((g) => (
                      <View key={g.group_id} style={styles.groupCard}>
                        <Text style={styles.groupName}>{g.name}</Text>
                        {g.criteria_text ? <Text style={styles.groupCriteria}>{g.criteria_text}</Text> : null}
                        <View style={styles.groupFooter}>
                          <Text style={styles.groupMembers}>
                            {g.members.length} member{g.members.length !== 1 ? 's' : ''}
                          </Text>
                          <TouchableOpacity
                            style={styles.joinButton}
                            onPress={() => handleJoinGroup(g.group_id, g.name)}
                          >
                            <Text style={styles.joinButtonText}>Join</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* CTA */}
                <Card style={styles.ctaCard}>
                  <Ionicons name="people-outline" size={36} color={colors.secondary} />
                  <Text style={styles.ctaTitle}>Create Your Group</Text>
                  <Text style={styles.ctaText}>
                    Describe your situation and we'll find others in the same boat.
                  </Text>
                  <TouchableOpacity style={styles.ctaButton} onPress={() => setTab('find')}>
                    <Text style={styles.ctaButtonText}>Create Group</Text>
                  </TouchableOpacity>
                </Card>
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Chat messages */}
            <View style={styles.chatContainer}>
              {messages.map((m) =>
                m.role === 'user' ? (
                  <View key={m.id} style={styles.userMessageRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{m.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={m.id} style={styles.aiBubble}>
                    <Text style={styles.aiBubbleText}>{m.content}</Text>
                  </View>
                )
              )}
              {loading && (
                <View style={styles.loadingDots}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </View>

            {/* Chat input */}
            <View style={styles.chatInput}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Describe your situation…"
                placeholderTextColor={colors.onSurfaceVariant}
                style={styles.input}
              />
              <TouchableOpacity
                onPress={send}
                disabled={!input.trim() || loading}
                style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
              >
                <Ionicons name="send" size={18} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>

            {/* Criteria pills */}
            {hasCriteria(draft) && (
              <Card style={styles.criteriaCard}>
                <Text style={styles.criteriaTitle}>Your Match Criteria</Text>
                <View style={styles.chipsRow}>
                  {draft.visa_applying_for.map((v) => (
                    <TouchableOpacity
                      key={`va-${v}`}
                      style={styles.chip}
                      onPress={() => removeChip('visa_applying_for', v)}
                    >
                      <Text style={styles.chipText}>{v}</Text>
                      <Ionicons name="close" size={14} color={colors.onPrimaryContainer} />
                    </TouchableOpacity>
                  ))}
                  {draft.current_visa_or_greencard_category.map((v) => (
                    <TouchableOpacity
                      key={`cv-${v}`}
                      style={styles.chip}
                      onPress={() => removeChip('current_visa_or_greencard_category', v)}
                    >
                      <Text style={styles.chipText}>{v}</Text>
                      <Ionicons name="close" size={14} color={colors.onPrimaryContainer} />
                    </TouchableOpacity>
                  ))}
                  {draft.consulates.map((c) => (
                    <TouchableOpacity
                      key={`con-${c}`}
                      style={[styles.chip, styles.chipSecondary]}
                      onPress={() => removeChip('consulates', c)}
                    >
                      <Ionicons name="location-outline" size={12} color={colors.onSurfaceVariant} />
                      <Text style={styles.chipTextSecondary}>{c}</Text>
                      <Ionicons name="close" size={14} color={colors.onSurfaceVariant} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.findButton}
                  onPress={runMatches}
                  disabled={matchLoading}
                >
                  <Text style={styles.findButtonText}>
                    {matchLoading ? 'Finding…' : 'Find Matches'}
                  </Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* Matches */}
            {searched && (
              <Card style={styles.matchesCard}>
                <Text style={styles.matchesTitle}>
                  {matches.length > 0 ? `${matches.length} Match${matches.length !== 1 ? 'es' : ''}` : 'No Matches'}
                </Text>
                {matches.length === 0 ? (
                  <Text style={styles.noMatchText}>
                    No one matches these criteria yet. Try broadening them in the chat.
                  </Text>
                ) : (
                  <>
                    {matches.map((m) => (
                      <MatchCard
                        key={m.user_id}
                        match={m}
                        checked={selected.has(m.user_id)}
                        onToggle={toggle}
                      />
                    ))}
                    <TouchableOpacity style={styles.createGroupButton} onPress={handleCreateGroup}>
                      <Text style={styles.createGroupText}>
                        Create Group{selected.size > 0 ? ` (+${selected.size})` : ''}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </Card>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface,
  },
  userPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userLabel: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.marginMobile,
    gap: 8,
    marginBottom: spacing.sm,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  tabActive: {
    backgroundColor: colors.primaryContainer,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onPrimaryContainer,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.marginMobile,
    paddingBottom: spacing.lg,
  },
  loader: {
    marginTop: spacing.lg,
  },
  errorCard: {
    marginHorizontal: spacing.marginMobile,
    padding: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.default,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.onErrorContainer,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  groupCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  groupCriteria: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  groupMembers: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  joinButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: borderRadius.default,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSecondary,
  },
  ctaCard: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  ctaText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
  },
  chatContainer: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '85%',
  },
  userBubbleText: {
    fontSize: 14,
    color: colors.onPrimaryContainer,
  },
  aiBubble: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    borderTopLeftRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '90%',
  },
  aiBubbleText: {
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 20,
  },
  loadingDots: {
    paddingVertical: spacing.base,
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.onSurface,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  criteriaCard: {
    marginBottom: spacing.md,
  },
  criteriaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  chipText: {
    fontSize: 12,
    color: colors.onPrimaryContainer,
  },
  chipSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  chipTextSecondary: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  findButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
    alignItems: 'center',
  },
  findButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
  },
  matchesCard: {
    marginBottom: spacing.md,
  },
  matchesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  noMatchText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  createGroupButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  createGroupText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
  },
});

export default FindScreen;
