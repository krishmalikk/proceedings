import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { Card } from '../components';
import {
  getTagVocab,
  suggestTags,
  createPosting,
  reconcile,
  getProfile,
  updateProfile,
  getActiveUserId,
  TagVocab,
  PostingGroups,
  ReconcileResult,
} from '../services/apiService';

const EMPTY_GROUPS: PostingGroups = {
  visa_applying_for: [],
  current_visa_or_greencard_category: [],
  primary_consulate: '',
  consulates: [],
  tags: [],
  concerns_or_questions_tags: [],
};

const POSTING_TYPE_LABEL: Record<string, string> = {
  consular_visa: 'Consular / visa abroad',
  in_us_status: 'In-US status',
  experience: 'Experience share',
  general_question: 'General question',
};

type TypeaheadOption = { value: string; label: string };

// RN equivalent of the website's <datalist> add input: filter the section's
// controlled vocab as the user types and surface tappable suggestions. Only
// values from the list can be added (so submissions stay vocab-valid).
function TagTypeahead({
  options,
  placeholder,
  exclude,
  onAdd,
}: {
  options: TypeaheadOption[];
  placeholder: string;
  exclude: string[];
  onAdd: (value: string) => void;
}) {
  const [text, setText] = useState('');
  const q = text.trim().toLowerCase();
  const matches =
    q.length === 0
      ? []
      : options
          .filter((o) => !exclude.includes(o.value))
          .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
          .slice(0, 6);
  return (
    <View style={styles.typeaheadWrap}>
      <TextInput
        style={styles.typeaheadInput}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {matches.length > 0 && (
        <View style={styles.suggestRow}>
          {matches.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={styles.suggestChip}
              onPress={() => {
                onAdd(o.value);
                setText('');
              }}
            >
              <Ionicons name="add" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.suggestChipText}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function PostScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [groups, setGroups] = useState<PostingGroups>(EMPTY_GROUPS);
  const [stages, setStages] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [vocab, setVocab] = useState<TagVocab | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [postingType, setPostingType] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ case_id: string; author_handle: string } | null>(null);

  // Profile reconciliation (phase-J, website parity): conflicts between the
  // detected tags and the saved profile, with an offer to update the profile.
  const [conflicts, setConflicts] = useState<ReconcileResult['conflicts']>([]);
  const [explainer, setExplainer] = useState('');
  const [prefilled, setPrefilled] = useState<string[]>([]);
  const [profileUpdated, setProfileUpdated] = useState(false);

  // Manual stage/date add (website parity: stage_key + value, date_key + date).
  const [sKey, setSKey] = useState('');
  const [sVal, setSVal] = useState('');
  const [dKey, setDKey] = useState('');
  const [dVal, setDVal] = useState('');

  useEffect(() => {
    getTagVocab().then(setVocab).catch(() => {});
  }, []);

  const consulateByCode = useMemo(
    () => new Map(vocab?.consulate_options?.map((o) => [o.code, o.label]) || []),
    [vocab]
  );

  // Typeahead option lists per vocab kind ({value=stored code, label=display}).
  const visaOptions = useMemo<TypeaheadOption[]>(
    () => (vocab?.visa || []).map((v) => ({ value: v, label: v })),
    [vocab]
  );
  const tagOptions = useMemo<TypeaheadOption[]>(
    () => (vocab?.tag || []).map((v) => ({ value: v, label: v })),
    [vocab]
  );
  const consulateOptions = useMemo<TypeaheadOption[]>(
    () => (vocab?.consulate_options || []).map((o) => ({ value: o.code, label: o.label })),
    [vocab]
  );

  const canPreview = title.trim().length >= 3 && description.trim().length >= 10;
  const hasVisa = groups.visa_applying_for.length > 0 || groups.current_visa_or_greencard_category.length > 0;

  // Add a validated value (already from the vocab list) to a tag section.
  const addToGroup = (field: keyof PostingGroups, value: string) => {
    setError('');
    setGroups((g) => {
      const cur = g[field] as string[];
      return cur.includes(value) ? g : { ...g, [field]: [...cur, value] };
    });
  };

  const addStage = () => {
    const k = sKey.trim();
    const v = sVal.trim();
    if (!k || !v) return;
    if (vocab && vocab.stage_key.length > 0 && !vocab.stage_key.includes(k)) {
      setError(`"${k}" is not a valid stage key.`);
      return;
    }
    setError('');
    setStages((s) => ({ ...s, [k]: v }));
    setSKey('');
    setSVal('');
  };

  const addDate = () => {
    const k = dKey.trim();
    const v = dVal.trim();
    if (!k || !v) return;
    if (vocab && vocab.date_key.length > 0 && !vocab.date_key.includes(k)) {
      setError(`"${k}" is not a valid date key.`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setError('Date must be YYYY-MM-DD.');
      return;
    }
    setError('');
    setDates((d) => ({ ...d, [k]: v }));
    setDKey('');
    setDVal('');
  };

  const handlePreview = async () => {
    if (!canPreview) return;
    setPreviewing(true);
    setError('');
    try {
      const data = await suggestTags(title, description);
      const g: PostingGroups = { ...EMPTY_GROUPS, ...(data.groups || {}) };
      const st = data.key_stages_or_info || {};
      const dt = data.key_dates || {};
      setPostingType(data.posting_type || '');
      setConflicts([]);
      setExplainer('');
      setPrefilled([]);
      setProfileUpdated(false);

      // Reconcile against the saved profile (best-effort; website parity).
      let applied = false;
      if (getActiveUserId()) {
        try {
          const rd = await reconcile({ ...g, key_stages_or_info: st, key_dates: dt });
          const m = (rd.merged || {}) as unknown as Record<string, unknown>;
          setGroups({
            ...EMPTY_GROUPS,
            current_visa_or_greencard_category:
              (m.current_visa_or_greencard_category as string[]) ?? g.current_visa_or_greencard_category,
            visa_applying_for: (m.visa_applying_for as string[]) ?? g.visa_applying_for,
            primary_consulate: (m.primary_consulate as string) ?? g.primary_consulate,
            consulates: (m.consulates as string[]) ?? g.consulates,
            tags: g.tags,
            concerns_or_questions_tags: g.concerns_or_questions_tags,
          });
          setStages((m.key_stages_or_info as Record<string, string>) ?? st);
          setDates((m.key_dates as Record<string, string>) ?? dt);
          setConflicts(rd.conflicts || []);
          setExplainer(rd.explainer || '');
          setPrefilled(rd.prefilled || []);
          applied = true;
        } catch {
          // no active user / reconcile unavailable — post without it
        }
      }
      if (!applied) {
        setGroups(g);
        setStages(st);
        setDates(dt);
      }
      setPreviewed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze posting');
    } finally {
      setPreviewing(false);
    }
  };

  // Apply the conflicting values to the saved profile (website parity).
  const handleUpdateProfile = async () => {
    try {
      const cur = await getProfile();
      const next: Record<string, unknown> = { ...cur };
      for (const c of conflicts) {
        if (c.field.includes('.')) {
          const [mapF, key] = c.field.split('.');
          next[mapF] = { ...((next[mapF] as Record<string, unknown>) || {}), [key]: c.message_value };
        } else {
          next[c.field] = c.message_value;
        }
      }
      await updateProfile(next);
      setProfileUpdated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update profile');
    }
  };

  const removeTag = (field: keyof PostingGroups, value: string) => {
    setGroups((g) => ({
      ...g,
      [field]: (g[field] as string[]).filter((t) => t !== value),
    }));
  };

  const removeStage = (key: string) => {
    setStages((s) => {
      const n = { ...s };
      delete n[key];
      return n;
    });
  };

  const removeDate = (key: string) => {
    setDates((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
  };

  const handleSubmit = async () => {
    if (!hasVisa) {
      Alert.alert('Missing Info', 'Please add at least one visa/status.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await createPosting(title, description, groups, stages, dates);
      setDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish posting');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setDone(null);
    setTitle('');
    setDescription('');
    setGroups(EMPTY_GROUPS);
    setStages({});
    setDates({});
    setPreviewed(false);
    setPostingType('');
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.doneContainer}>
          <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          <Text style={styles.doneTitle}>Posted!</Text>
          <Text style={styles.doneText}>
            Published as <Text style={styles.doneBold}>{done.author_handle}</Text>. It may take a few
            minutes to appear in search results.
          </Text>
          <View style={styles.doneButtons}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('CaseDetails', { caseId: done.case_id })}
            >
              <Text style={styles.viewButtonText}>View Posting</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.anotherButton} onPress={handleReset}>
              <Text style={styles.anotherButtonText}>Post Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <Text style={styles.pageTitle}>Post a New Message</Text>
          <Text style={styles.pageSubtitle}>
            Share your immigration experience or question. Preview to see auto-suggested tags.
          </Text>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Title input */}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={300}
              placeholder="e.g. H-1B extension with an RFE — what to expect?"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.titleInput}
            />
          </View>

          {/* Description input */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={8000}
              multiline
              placeholder="Describe your situation, what happened, and what you're asking about…"
              placeholderTextColor={colors.onSurfaceVariant}
              style={styles.descriptionInput}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/8000</Text>
          </View>

          {/* Preview button */}
          <TouchableOpacity
            style={[styles.previewButton, (!canPreview || previewing) && styles.buttonDisabled]}
            onPress={handlePreview}
            disabled={!canPreview || previewing}
          >
            <Text style={styles.previewButtonText}>
              {previewing ? 'Analyzing…' : previewed ? 'Re-preview' : 'Preview'}
            </Text>
          </TouchableOpacity>

          {/* Tags panel */}
          {previewed && (
            <Card style={styles.tagsCard}>
              <View style={styles.tagsHeader}>
                <Ionicons name="pricetag-outline" size={20} color={colors.secondary} />
                <Text style={styles.tagsTitle}>Review Tags</Text>
                {postingType && (
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {POSTING_TYPE_LABEL[postingType] || postingType}
                    </Text>
                  </View>
                )}
              </View>

              {/* Profile reconciliation (website parity) */}
              {prefilled.length > 0 && conflicts.length === 0 && (
                <Text style={styles.prefilledNote}>
                  Pre-filled from your profile: {prefilled.map((f) => f.replace(/_/g, ' ')).join(', ')}.
                </Text>
              )}
              {conflicts.length > 0 && (
                <View style={styles.conflictCard}>
                  <Text style={styles.conflictText}>
                    {explainer || 'Some details differ from your saved profile.'}
                  </Text>
                  {conflicts.map((c) => (
                    <Text key={c.field} style={styles.conflictDetail}>
                      · {c.field.replace(/_/g, ' ').replace('.', ': ')} — profile: {String(c.profile_value)} → this post: {String(c.message_value)}
                    </Text>
                  ))}
                  {profileUpdated ? (
                    <Text style={styles.profileUpdatedNote}>Profile updated ✓</Text>
                  ) : (
                    <TouchableOpacity style={styles.conflictButton} onPress={handleUpdateProfile}>
                      <Text style={styles.conflictButtonText}>Update my profile to match</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Visa applying for */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Visa / category applying for</Text>
                <View style={styles.tagsRow}>
                  {groups.visa_applying_for.length === 0 ? (
                    <Text style={styles.noTags}>None</Text>
                  ) : (
                    groups.visa_applying_for.map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={styles.tag}
                        onPress={() => removeTag('visa_applying_for', v)}
                      >
                        <Text style={styles.tagText}>{v}</Text>
                        <Ionicons name="close" size={14} color={colors.onPrimaryContainer} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
                <TagTypeahead
                  options={visaOptions}
                  placeholder="Add visa applying for…"
                  exclude={groups.visa_applying_for}
                  onAdd={(v) => addToGroup('visa_applying_for', v)}
                />
              </View>

              {/* Current status */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Current status</Text>
                <View style={styles.tagsRow}>
                  {groups.current_visa_or_greencard_category.length === 0 ? (
                    <Text style={styles.noTags}>None</Text>
                  ) : (
                    groups.current_visa_or_greencard_category.map((v) => (
                      <TouchableOpacity
                        key={v}
                        style={styles.tag}
                        onPress={() => removeTag('current_visa_or_greencard_category', v)}
                      >
                        <Text style={styles.tagText}>{v}</Text>
                        <Ionicons name="close" size={14} color={colors.onPrimaryContainer} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
                <TagTypeahead
                  options={visaOptions}
                  placeholder="Add current status…"
                  exclude={groups.current_visa_or_greencard_category}
                  onAdd={(v) => addToGroup('current_visa_or_greencard_category', v)}
                />
              </View>

              {/* Consulates */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Consulate</Text>
                <View style={styles.tagsRow}>
                  {groups.consulates.length === 0 ? (
                    <Text style={styles.noTags}>None</Text>
                  ) : (
                    groups.consulates.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.tag, styles.tagSecondary]}
                        onPress={() => removeTag('consulates', c)}
                      >
                        <Ionicons name="location-outline" size={12} color={colors.onSurfaceVariant} />
                        <Text style={styles.tagTextSecondary}>
                          {consulateByCode.get(c) || c}
                        </Text>
                        <Ionicons name="close" size={14} color={colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
                <TagTypeahead
                  options={consulateOptions}
                  placeholder="Search by city or country…"
                  exclude={groups.consulates}
                  onAdd={(c) => addToGroup('consulates', c)}
                />
              </View>

              {/* Background tags */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Background tags</Text>
                <View style={styles.tagsRow}>
                  {groups.tags.length === 0 ? (
                    <Text style={styles.noTags}>None</Text>
                  ) : (
                    groups.tags.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.tag, styles.tagSecondary]}
                        onPress={() => removeTag('tags', t)}
                      >
                        <Text style={styles.tagTextSecondary}>{t}</Text>
                        <Ionicons name="close" size={14} color={colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
                <TagTypeahead
                  options={tagOptions}
                  placeholder="Add background tags…"
                  exclude={groups.tags}
                  onAdd={(t) => addToGroup('tags', t)}
                />
              </View>

              {/* Questions / concerns */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Your questions / concerns</Text>
                <View style={styles.tagsRow}>
                  {groups.concerns_or_questions_tags.length === 0 ? (
                    <Text style={styles.noTags}>None</Text>
                  ) : (
                    groups.concerns_or_questions_tags.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.tag, styles.tagSecondary]}
                        onPress={() => removeTag('concerns_or_questions_tags', t)}
                      >
                        <Text style={styles.tagTextSecondary}>{t}</Text>
                        <Ionicons name="close" size={14} color={colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
                <TagTypeahead
                  options={tagOptions}
                  placeholder="Add questions / concerns…"
                  exclude={groups.concerns_or_questions_tags}
                  onAdd={(t) => addToGroup('concerns_or_questions_tags', t)}
                />
              </View>

              {/* Stages / outcomes (add-row always available so the first can be added) */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Process / outcome</Text>
                {Object.keys(stages).length > 0 && (
                  <View style={styles.tagsRow}>
                    {Object.entries(stages).map(([k, v]) => (
                      <TouchableOpacity
                        key={k}
                        style={[styles.tag, styles.tagSecondary]}
                        onPress={() => removeStage(k)}
                      >
                        <Text style={styles.tagTextSecondary}>{k}: {v}</Text>
                        <Ionicons name="close" size={14} color={colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.kvRow}>
                  <TextInput
                    style={[styles.typeaheadInput, styles.kvInput]}
                    value={sKey}
                    onChangeText={setSKey}
                    placeholder="stage key"
                    placeholderTextColor={colors.onSurfaceVariant}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.typeaheadInput, styles.kvInput]}
                    value={sVal}
                    onChangeText={setSVal}
                    placeholder="value"
                    placeholderTextColor={colors.onSurfaceVariant}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.kvAddButton} onPress={addStage}>
                    <Text style={styles.kvAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Key dates (add-row always available) */}
              <View style={styles.tagSection}>
                <Text style={styles.tagSectionLabel}>Key dates</Text>
                {Object.keys(dates).length > 0 && (
                  <View style={styles.tagsRow}>
                    {Object.entries(dates).map(([k, v]) => (
                      <TouchableOpacity
                        key={k}
                        style={[styles.tag, styles.tagSecondary]}
                        onPress={() => removeDate(k)}
                      >
                        <Text style={styles.tagTextSecondary}>{k}: {v}</Text>
                        <Ionicons name="close" size={14} color={colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.kvRow}>
                  <TextInput
                    style={[styles.typeaheadInput, styles.kvInput]}
                    value={dKey}
                    onChangeText={setDKey}
                    placeholder="date key"
                    placeholderTextColor={colors.onSurfaceVariant}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.typeaheadInput, styles.kvInput]}
                    value={dVal}
                    onChangeText={setDVal}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.onSurfaceVariant}
                    keyboardType="numbers-and-punctuation"
                  />
                  <TouchableOpacity style={styles.kvAddButton} onPress={addDate}>
                    <Text style={styles.kvAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit */}
              <View style={styles.submitSection}>
                {!hasVisa && (
                  <Text style={styles.warningText}>
                    Add at least one visa/status under "Visa/category applying for" or "Current status".
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.submitButton, (submitting || !hasVisa) && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting || !hasVisa}
                >
                  <Text style={styles.submitButtonText}>
                    {submitting ? 'Publishing…' : 'Submit Posting'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.disclaimer}>
                  Posted anonymously under a generated handle. Don't include personal identifiers.
                </Text>
              </View>
            </Card>
          )}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.marginMobile,
    paddingBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  errorCard: {
    padding: spacing.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.default,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.onErrorContainer,
    fontSize: 14,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.onSurface,
  },
  descriptionInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 200,
  },
  charCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'right',
  },
  previewButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.default,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  prefilledNote: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: spacing.base },
  conflictCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  conflictText: { fontSize: 14, color: colors.onSurface },
  conflictDetail: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  conflictButton: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginTop: spacing.base,
  },
  conflictButtonText: { color: colors.onSecondaryContainer, fontWeight: '600', fontSize: 13 },
  profileUpdatedNote: { color: colors.primary, fontSize: 12, marginTop: spacing.base },
  tagsCard: {
    marginBottom: spacing.md,
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    flex: 1,
  },
  typeBadge: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  typeaheadWrap: { marginTop: spacing.base },
  typeaheadInput: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.onSurface,
  },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base, marginTop: spacing.base },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingVertical: 5,
    paddingHorizontal: spacing.base,
  },
  suggestChipText: { fontSize: 12, color: colors.onSurfaceVariant },
  kvRow: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.base, alignItems: 'center' },
  kvInput: { flex: 1, marginTop: 0 },
  kvAddButton: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  kvAddText: { color: colors.onSecondaryContainer, fontWeight: '600', fontSize: 13 },
  tagSection: {
    marginBottom: spacing.sm,
  },
  tagSectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  noTags: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: 12,
    color: colors.onPrimaryContainer,
  },
  tagSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  tagTextSecondary: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  submitSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  warningText: {
    fontSize: 12,
    color: colors.error,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.default,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: spacing.md,
  },
  doneText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  doneBold: {
    fontWeight: '600',
    color: colors.onSurface,
  },
  doneButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  viewButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onPrimary,
  },
  anotherButton: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
  },
  anotherButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onSurface,
  },
});

export default PostScreen;
