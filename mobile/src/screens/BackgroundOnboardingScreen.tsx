import React, { useState } from 'react';
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
import {
  VISA_CATEGORIES,
  CONSULATES,
  TAGS,
  KEY_STAGES,
  STAGE_OUTCOMES,
  KEY_DATE_TYPES,
  OnboardingProfile,
  createEmptyProfile,
} from '../constants/onboardingData';

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

  const handleContinue = () => {
    navigation.navigate('ExperiencesOnboarding', { profile });
  };

  const handleSkip = () => {
    navigation.navigate('ExperiencesOnboarding', { profile, skipped: true });
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
                options={VISA_CATEGORIES}
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
                options={VISA_CATEGORIES}
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
                options={CONSULATES}
                selectedValues={profile.consulates}
                onSelectionChange={(values) => updateProfile('consulates', values)}
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
                        {STAGE_OUTCOMES.map((outcome) => (
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
            <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
              <Text style={styles.primaryButtonText}>Continue</Text>
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
