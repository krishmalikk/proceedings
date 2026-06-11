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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { MILESTONES, JourneyEntry, OnboardingProfile } from '../constants/onboardingData';
import { useAuth } from '../contexts/AuthContext';

type RouteParams = {
  ExperiencesOnboarding: {
    profile: OnboardingProfile;
    skipped?: boolean;
  };
};

export function ExperiencesOnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'ExperiencesOnboarding'>>();
  const { completeOnboarding } = useAuth();

  const { profile, skipped } = route.params || {};

  const [experiences, setExperiences] = useState<JourneyEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState('');
  const [experienceDate, setExperienceDate] = useState('');
  const [experienceText, setExperienceText] = useState('');
  const [shareExperience, setShareExperience] = useState(true);

  const addExperience = () => {
    if (selectedMilestone && experienceText.trim()) {
      const newEntry: JourneyEntry = {
        milestone: selectedMilestone,
        date: experienceDate,
        experience: experienceText.trim(),
        shared: shareExperience,
      };
      setExperiences([...experiences, newEntry]);
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedMilestone('');
    setExperienceDate('');
    setExperienceText('');
    setShareExperience(true);
    setShowAddForm(false);
  };

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    // Save profile and experiences (for now just mark onboarding complete)
    await completeOnboarding();
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const getMilestoneLabel = (key: string) => {
    return MILESTONES.find((m) => m.key === key)?.label || key;
  };

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
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={styles.title}>Share your experiences</Text>
            <Text style={styles.subtitle}>
              Help others by sharing what you've been through. Your experiences can guide
              someone in a similar situation.
            </Text>
          </View>

          {/* Existing experiences */}
          {experiences.length > 0 && (
            <View style={styles.experiencesList}>
              <Text style={styles.sectionLabel}>Your experiences ({experiences.length})</Text>
              {experiences.map((exp, index) => (
                <View key={index} style={styles.experienceCard}>
                  <View style={styles.experienceHeader}>
                    <View style={styles.milestoneBadge}>
                      <Text style={styles.milestoneBadgeText}>
                        {getMilestoneLabel(exp.milestone)}
                      </Text>
                    </View>
                    {exp.date && (
                      <Text style={styles.experienceDate}>{exp.date}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeExperience(index)}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.experienceText} numberOfLines={3}>
                    {exp.experience}
                  </Text>
                  {exp.shared && (
                    <View style={styles.sharedBadge}>
                      <Ionicons name="people" size={14} color={colors.secondary} />
                      <Text style={styles.sharedBadgeText}>Shared with community</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Add experience form */}
          {showAddForm ? (
            <View style={styles.addForm}>
              <Text style={styles.sectionLabel}>Add an experience</Text>

              {/* Milestone selection */}
              <Text style={styles.inputLabel}>What milestone?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.milestoneScroll}
              >
                {MILESTONES.map((milestone) => (
                  <TouchableOpacity
                    key={milestone.key}
                    style={[
                      styles.milestoneChip,
                      selectedMilestone === milestone.key && styles.milestoneChipSelected,
                    ]}
                    onPress={() => setSelectedMilestone(milestone.key)}
                  >
                    <Text
                      style={[
                        styles.milestoneChipText,
                        selectedMilestone === milestone.key && styles.milestoneChipTextSelected,
                      ]}
                    >
                      {milestone.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Date input */}
              <Text style={styles.inputLabel}>When? (optional)</Text>
              <TextInput
                style={styles.input}
                value={experienceDate}
                onChangeText={setExperienceDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.onSurfaceVariant}
                autoComplete="off"
                textContentType="none"
              />

              {/* Experience text */}
              <Text style={styles.inputLabel}>What happened?</Text>
              <TextInput
                style={styles.textArea}
                value={experienceText}
                onChangeText={setExperienceText}
                placeholder="Share your experience... What went well? What would you do differently? Any tips for others?"
                placeholderTextColor={colors.onSurfaceVariant}
                multiline
                numberOfLines={5}
                maxLength={4000}
                textAlignVertical="top"
                autoComplete="off"
                textContentType="none"
              />
              <Text style={styles.charCount}>{experienceText.length}/4000</Text>

              {/* Share toggle */}
              <View style={styles.shareToggle}>
                <View style={styles.shareToggleText}>
                  <Ionicons name="people-outline" size={20} color={colors.onSurface} />
                  <Text style={styles.shareLabel}>Share with community</Text>
                </View>
                <Switch
                  value={shareExperience}
                  onValueChange={setShareExperience}
                  trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                  thumbColor={shareExperience ? colors.primary : colors.surfaceContainerHigh}
                />
              </View>
              <Text style={styles.shareHint}>
                Shared experiences help others find people with similar journeys
              </Text>

              {/* Form buttons */}
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    (!selectedMilestone || !experienceText.trim()) && styles.addButtonDisabled,
                  ]}
                  onPress={addExperience}
                  disabled={!selectedMilestone || !experienceText.trim()}
                >
                  <Ionicons name="add" size={20} color={colors.onPrimary} />
                  <Text style={styles.addButtonText}>Add Experience</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addExperienceButton}
              onPress={() => setShowAddForm(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.addExperienceButtonText}>Add an experience</Text>
            </TouchableOpacity>
          )}

          {/* Suggested milestones */}
          {!showAddForm && experiences.length === 0 && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>Popular milestones to share:</Text>
              <View style={styles.suggestionChips}>
                {['visa_interview', 'h1b_approval', 'i140_approval', 'biometrics', 'green_card'].map(
                  (key) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.suggestionChip}
                      onPress={() => {
                        setSelectedMilestone(key);
                        setShowAddForm(true);
                      }}
                    >
                      <Text style={styles.suggestionChipText}>{getMilestoneLabel(key)}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}

          {/* Complete button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
              <Text style={styles.primaryButtonText}>Complete Setup</Text>
              <Ionicons name="checkmark-circle" size={20} color={colors.onPrimary} />
            </TouchableOpacity>

            {experiences.length === 0 && (
              <TouchableOpacity style={styles.skipButton} onPress={handleComplete}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Info text */}
          <Text style={styles.infoText}>
            You can always add or edit your experiences later from your profile.
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
  experiencesList: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  experienceCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  experienceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    gap: 8,
  },
  milestoneBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  milestoneBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  experienceDate: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  experienceText: {
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 20,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.base,
    gap: 4,
  },
  sharedBadgeText: {
    fontSize: 12,
    color: colors.secondary,
  },
  addForm: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: spacing.base,
    marginTop: spacing.sm,
  },
  milestoneScroll: {
    marginBottom: spacing.sm,
  },
  milestoneChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    marginRight: spacing.base,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  milestoneChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  milestoneChipText: {
    fontSize: 13,
    color: colors.onSurface,
  },
  milestoneChipTextSelected: {
    color: colors.onPrimary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.default,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
  },
  textArea: {
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.default,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    marginTop: 4,
  },
  shareToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  shareToggleText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
  },
  shareHint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  formButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
    gap: 6,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    paddingVertical: 12,
    borderRadius: borderRadius.default,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
  },
  addExperienceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    gap: 8,
    marginBottom: spacing.md,
  },
  addExperienceButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  suggestions: {
    marginBottom: spacing.md,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondaryContainer,
    marginRight: spacing.base,
    marginBottom: spacing.base,
  },
  suggestionChipText: {
    fontSize: 13,
    color: colors.onSecondaryContainer,
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
  infoText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});

export default ExperiencesOnboardingScreen;
