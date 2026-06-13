import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { ChipSelector } from '../components/ChipSelector';
import Markdown from '../components/Markdown';
import {
  VISA_CATEGORIES,
  CONSULATE_OPTIONS,
  TAGS,
  KEY_STAGES,
  STAGE_OUTCOMES,
  KEY_DATE_TYPES,
  OnboardingProfile,
  JourneyEntry,
  createEmptyProfile,
  toBackendProfile,
  fromBackendProfile,
} from '../constants/onboardingData';
import {
  getTagVocab,
  getProfile,
  updateProfile as saveProfileToBackend,
  onboardTurn,
  getActiveUserId,
  TagVocab,
} from '../services/apiService';
import { ActivityIndicator, Alert } from 'react-native';

type Turn = { id: string; role: 'user' | 'ai'; content: string };

// Same greetings as the website's onboarding chat.
const GREETING_SETUP =
  "Hi! Let's set up the basics of your immigration profile — your current situation, journey and key dates. " +
  'Tell me about your situation (or fill in the sections below) and I\'ll turn it into tags. ' +
  "Please don't share personal details like your name, date of birth, or passport number.";

const GREETING_RETURNING =
  'Welcome back! Your current tags are below. Update them directly, edit your background and tap ' +
  '"Re-generate tags", or just tell me what changed (e.g. "my I-140 was approved on March 1") and ' +
  "I'll update the tags for you.";

export function BackgroundOnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [profile, setProfile] = useState<OnboardingProfile>(createEmptyProfile());
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    status: true,
    applying: false,
    consulates: false,
    tags: false,
    stages: false,
    dates: false,
  });
  const [selectedStageKey, setSelectedStageKey] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState('');

  // Live controlled vocabulary (falls back to the baked constants offline).
  const [vocab, setVocab] = useState<TagVocab | null>(null);
  useEffect(() => {
    getTagVocab().then(setVocab);
  }, []);

  // AI onboarding chat (website parity: POST /api/onboard, stage 'basics').
  const [messages, setMessages] = useState<Turn[]>([
    { id: 'greet', role: 'ai', content: GREETING_SETUP },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenNote, setRegenNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Existing journey is carried through so edits never wipe published experiences.
  const [journey, setJourney] = useState<JourneyEntry[]>([]);

  // Prefill from the saved profile (returning users get the "welcome back" greeting).
  useEffect(() => {
    if (!getActiveUserId()) return;
    getProfile()
      .then((p) => {
        const mapped = fromBackendProfile(p as never);
        const hasData =
          mapped.currentStatus.length > 0 ||
          mapped.applyingFor.length > 0 ||
          mapped.consulates.length > 0 ||
          mapped.tags.length > 0 ||
          Object.keys(mapped.keyStages).length > 0 ||
          Object.keys(mapped.keyDates).length > 0 ||
          mapped.backgroundText.trim().length > 0;
        if (hasData) {
          setProfile(mapped);
          setMessages([{ id: 'greet', role: 'ai', content: GREETING_RETURNING }]);
        }
        const j = (p as { journey?: JourneyEntry[] }).journey;
        if (Array.isArray(j)) setJourney(j);
      })
      .catch(() => {
        // New/unregistered user — keep the empty form + setup greeting.
      });
  }, []);

  // One assistant turn: the AI updates the tags below from the conversation.
  const sendChat = async () => {
    const t = chatInput.trim();
    if (!t || chatLoading) return;
    setChatInput('');
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', content: t }]);
    setChatLoading(true);
    try {
      const data = await onboardTurn(
        'basics',
        [...history, { role: 'user', content: t }],
        toBackendProfile(profile, journey)
      );
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: 'ai', content: data.reply }]);
      setProfile(fromBackendProfile(data.profile));
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-x`, role: 'ai', content: e instanceof Error ? e.message : 'Assistant error' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Re-derive the tags from the free-text background (one-shot; website parity).
  const regenTags = async () => {
    const text = profile.backgroundText.trim();
    if (text.length < 10 || regenLoading) return;
    setRegenLoading(true);
    setRegenNote('');
    try {
      const data = await onboardTurn(
        'basics',
        [{ role: 'user', content: text }],
        toBackendProfile(profile, journey)
      );
      const mapped = fromBackendProfile(data.profile);
      setProfile({ ...mapped, backgroundText: mapped.backgroundText || text });
      setRegenNote('Tags updated from your background ✓');
    } catch (e) {
      setRegenNote(e instanceof Error ? e.message : 'Could not re-generate tags');
    } finally {
      setRegenLoading(false);
    }
  };
  const visaOptions = vocab?.visa?.length ? vocab.visa : VISA_CATEGORIES;
  const outcomeOptions = vocab?.outcome?.length ? vocab.outcome : STAGE_OUTCOMES;
  // Consulates: curated list for mobile chips, but store the 1.4 CODE in the
  // profile (the backend drops anything that isn't a valid code).
  const consulateLabelByCode = useMemo(
    () => new Map(CONSULATE_OPTIONS.map((o) => [o.code, o.label])),
    []
  );
  const consulateCodeByLabel = useMemo(
    () => new Map(CONSULATE_OPTIONS.map((o) => [o.label, o.code])),
    []
  );
  const consulateLabels = CONSULATE_OPTIONS.map((o) => o.label);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateProfile = <K extends keyof OnboardingProfile>(
    key: K,
    value: OnboardingProfile[K]
  ) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const addKeyStage = (key: string, outcome: string) => {
    if (key && outcome) {
      setProfile((prev) => ({
        ...prev,
        keyStages: { ...prev.keyStages, [key]: outcome },
      }));
      setSelectedStageKey('');
    }
  };

  const removeKeyStage = (key: string) => {
    setProfile((prev) => {
      const newStages = { ...prev.keyStages };
      delete newStages[key];
      return { ...prev, keyStages: newStages };
    });
  };

  const addKeyDate = (key: string, date: string) => {
    if (key && date) {
      setProfile((prev) => ({
        ...prev,
        keyDates: { ...prev.keyDates, [key]: date },
      }));
      setSelectedDateKey('');
    }
  };

  const removeKeyDate = (key: string) => {
    setProfile((prev) => {
      const newDates = { ...prev.keyDates };
      delete newDates[key];
      return { ...prev, keyDates: newDates };
    });
  };

  // Website parity: stage 1 SAVES the basics before moving on to experiences
  // (existing journey is preserved in the payload).
  const handleContinue = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveProfileToBackend(toBackendProfile(profile, journey) as unknown as Record<string, unknown>);
      navigation.navigate('ExperiencesOnboarding', { profile, journey });
    } catch (e) {
      Alert.alert(
        'Could not save your profile',
        e instanceof Error ? e.message : 'Please check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('ExperiencesOnboarding', { profile, journey, skipped: true });
  };

  const SectionHeader = ({
    title,
    section,
    count,
  }: {
    title: string;
    section: string;
    count?: number;
  }) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => toggleSection(section)}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      <Ionicons
        name={expandedSections[section] ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Tell us about your journey</Text>
            <Text style={styles.subtitle}>
              This helps us connect you with others in similar situations
            </Text>
          </View>

          {/* AI assistant chat (website parity: chat → tags update below) */}
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Ionicons name="sparkles-outline" size={16} color={colors.secondary} />
              <Text style={styles.chatTitle}>AI assistant</Text>
            </View>
            <View style={styles.chatThread}>
              {messages.map((m) =>
                m.role === 'user' ? (
                  <View key={m.id} style={styles.chatBubbleUserWrap}>
                    <View style={styles.chatBubbleUser}>
                      <Text style={styles.chatBubbleUserText}>{m.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View key={m.id} style={styles.chatBubbleAi}>
                    <Markdown>{m.content}</Markdown>
                  </View>
                )
              )}
              {chatLoading && <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />}
            </View>
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Describe your situation…"
                placeholderTextColor={colors.onSurfaceVariant}
                onSubmitEditing={sendChat}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.chatSend, (!chatInput.trim() || chatLoading) && styles.chatSendDisabled]}
                onPress={sendChat}
                disabled={!chatInput.trim() || chatLoading}
              >
                <Ionicons name="send" size={16} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Background Text */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Describe your situation</Text>
            <TextInput
              style={styles.textArea}
              value={profile.backgroundText}
              onChangeText={(text) => updateProfile('backgroundText', text)}
              placeholder="E.g., On H-1B from India, EB-2 PERM certified, I-140 filed, waiting for priority date..."
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
              autoComplete="off"
              textContentType="none"
            />
            <Text style={styles.charCount}>
              {profile.backgroundText.length}/2000
            </Text>
            {/* Website parity: re-derive the tags from the background text */}
            <View style={styles.regenRow}>
              <TouchableOpacity
                style={[styles.regenButton, (regenLoading || profile.backgroundText.trim().length < 10) && styles.chatSendDisabled]}
                onPress={regenTags}
                disabled={regenLoading || profile.backgroundText.trim().length < 10}
              >
                <Ionicons name="color-wand-outline" size={16} color={colors.onPrimary} />
                <Text style={styles.regenButtonText}>{regenLoading ? 'Analyzing…' : 'Re-generate tags'}</Text>
              </TouchableOpacity>
              {!!regenNote && <Text style={styles.regenNote}>{regenNote}</Text>}
            </View>
          </View>

          {/* Current Status */}
          <View style={styles.section}>
            <SectionHeader
              title="Current Status"
              section="status"
              count={profile.currentStatus.length}
            />
            {expandedSections.status && (
              <ChipSelector
                label=""
                options={visaOptions}
                selectedValues={profile.currentStatus}
                onSelectionChange={(values) => updateProfile('currentStatus', values)}
              />
            )}
          </View>

          {/* Applying For */}
          <View style={styles.section}>
            <SectionHeader
              title="Applying For"
              section="applying"
              count={profile.applyingFor.length}
            />
            {expandedSections.applying && (
              <ChipSelector
                label=""
                options={visaOptions}
                selectedValues={profile.applyingFor}
                onSelectionChange={(values) => updateProfile('applyingFor', values)}
              />
            )}
          </View>

          {/* Consulates */}
          <View style={styles.section}>
            <SectionHeader
              title="Consulate(s)"
              section="consulates"
              count={profile.consulates.length}
            />
            {expandedSections.consulates && (
              <ChipSelector
                label=""
                options={consulateLabels}
                selectedValues={profile.consulates.map((c) => consulateLabelByCode.get(c) || c)}
                onSelectionChange={(labels) =>
                  updateProfile(
                    'consulates',
                    labels.map((l) => consulateCodeByLabel.get(l) || l)
                  )
                }
              />
            )}
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <SectionHeader
              title="Tags"
              section="tags"
              count={profile.tags.length}
            />
            {expandedSections.tags && (
              <ChipSelector
                label=""
                options={TAGS}
                selectedValues={profile.tags}
                onSelectionChange={(values) => updateProfile('tags', values)}
              />
            )}
          </View>

          {/* Key Stages */}
          <View style={styles.section}>
            <SectionHeader
              title="Key Stages"
              section="stages"
              count={Object.keys(profile.keyStages).length}
            />
            {expandedSections.stages && (
              <View style={styles.keyValueSection}>
                {/* Existing stages */}
                {Object.entries(profile.keyStages).map(([key, value]) => (
                  <View key={key} style={styles.keyValueItem}>
                    <Text style={styles.keyValueText}>
                      {KEY_STAGES.find((s) => s.key === key)?.label || key}: {value}
                    </Text>
                    <TouchableOpacity onPress={() => removeKeyStage(key)}>
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add new stage */}
                <View style={styles.addKeyValueRow}>
                  <View style={styles.pickerWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {KEY_STAGES.filter((s) => !profile.keyStages[s.key]).map((stage) => (
                        <TouchableOpacity
                          key={stage.key}
                          style={[
                            styles.miniChip,
                            selectedStageKey === stage.key && styles.miniChipSelected,
                          ]}
                          onPress={() => setSelectedStageKey(stage.key)}
                        >
                          <Text
                            style={[
                              styles.miniChipText,
                              selectedStageKey === stage.key && styles.miniChipTextSelected,
                            ]}
                          >
                            {stage.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {selectedStageKey && (
                    <View style={styles.outcomeRow}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {outcomeOptions.map((outcome) => (
                          <TouchableOpacity
                            key={outcome}
                            style={styles.outcomeChip}
                            onPress={() => addKeyStage(selectedStageKey, outcome)}
                          >
                            <Text style={styles.outcomeChipText}>{outcome}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Key Dates */}
          <View style={styles.section}>
            <SectionHeader
              title="Key Dates"
              section="dates"
              count={Object.keys(profile.keyDates).length}
            />
            {expandedSections.dates && (
              <View style={styles.keyValueSection}>
                {/* Existing dates */}
                {Object.entries(profile.keyDates).map(([key, value]) => (
                  <View key={key} style={styles.keyValueItem}>
                    <Text style={styles.keyValueText}>
                      {KEY_DATE_TYPES.find((d) => d.key === key)?.label || key}: {value}
                    </Text>
                    <TouchableOpacity onPress={() => removeKeyDate(key)}>
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add new date */}
                <View style={styles.addKeyValueRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {KEY_DATE_TYPES.filter((d) => !profile.keyDates[d.key]).map((dateType) => (
                      <TouchableOpacity
                        key={dateType.key}
                        style={[
                          styles.miniChip,
                          selectedDateKey === dateType.key && styles.miniChipSelected,
                        ]}
                        onPress={() => setSelectedDateKey(dateType.key)}
                      >
                        <Text
                          style={[
                            styles.miniChipText,
                            selectedDateKey === dateType.key && styles.miniChipTextSelected,
                          ]}
                        >
                          {dateType.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {selectedDateKey && (
                    <TextInput
                      style={styles.dateInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.onSurfaceVariant}
                      onSubmitEditing={(e) => {
                        const date = e.nativeEvent.text;
                        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          addKeyDate(selectedDateKey, date);
                        }
                      }}
                      autoComplete="off"
                      textContentType="none"
                    />
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Continue'}</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy notice */}
          <Text style={styles.privacyText}>
            Your information is private by default. You can choose to share specific
            experiences with the community later.
          </Text>
        </ScrollView>
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
  scrollContent: {
    padding: spacing.marginMobile,
    paddingBottom: spacing.xl,
  },
  chatCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.base },
  chatTitle: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  chatThread: { gap: spacing.base, maxHeight: 280 },
  chatBubbleUserWrap: { alignItems: 'flex-end' },
  chatBubbleUser: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.md,
    borderTopRightRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    maxWidth: '85%',
  },
  chatBubbleUserText: { fontSize: 14, color: colors.onPrimaryContainer },
  chatBubbleAi: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.md,
    borderTopLeftRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    maxWidth: '90%',
    alignSelf: 'flex-start',
  },
  chatBubbleAiText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  chatInputRow: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.md },
  chatInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.onSurface,
  },
  chatSend: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendDisabled: { opacity: 0.4 },
  regenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginTop: spacing.base, flexWrap: 'wrap' },
  regenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  regenButtonText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
  regenNote: { fontSize: 12, color: colors.primary },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  subtitle: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  textArea: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.onSurface,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
  },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  keyValueSection: {
    padding: spacing.sm,
  },
  keyValueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing.sm,
    borderRadius: borderRadius.default,
    marginBottom: spacing.base,
  },
  keyValueText: {
    fontSize: 14,
    color: colors.onSurface,
    flex: 1,
  },
  addKeyValueRow: {
    marginTop: spacing.base,
  },
  pickerWrapper: {
    marginBottom: spacing.base,
  },
  miniChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    marginRight: spacing.base,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  miniChipSelected: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  miniChipText: {
    fontSize: 13,
    color: colors.onSurface,
  },
  miniChipTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  outcomeRow: {
    marginTop: spacing.base,
  },
  outcomeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondaryContainer,
    marginRight: spacing.base,
  },
  outcomeChipText: {
    fontSize: 13,
    color: colors.onSecondaryContainer,
  },
  dateInput: {
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.default,
    padding: spacing.sm,
    marginTop: spacing.base,
    fontSize: 14,
    color: colors.onSurface,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.default,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  privacyText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});

export default BackgroundOnboardingScreen;
