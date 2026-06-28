import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';
import { AnimatedPressable, Header } from '../components';
import { getAllGroups, GroupInfo } from '../services/apiService';
import { forumThreads } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';

// Preview experiences for home screen
const PREVIEW_EXPERIENCES = [
  {
    case_id: 'preview-1',
    title: 'H-1B Interview at Mumbai Consulate - Approved!',
    visa: ['H-1B'],
    consulates: ['Mumbai'],
    outcome: 'Approved',
    description: 'Sharing my experience for others going through the same process...',
  },
  {
    case_id: 'preview-2',
    title: 'F-1 to H-1B Change of Status Timeline',
    visa: ['F-1', 'H-1B'],
    consulates: [],
    outcome: 'Approved',
    description: 'My complete timeline from OPT to H-1B approval...',
  },
];

// Preview community threads
const PREVIEW_THREADS = forumThreads.slice(0, 2);

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const [userGroups, setUserGroups] = useState<GroupInfo[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Get first name from displayName or email
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';

  // Load user's groups on mount
  useEffect(() => {
    async function loadGroups() {
      try {
        const data = await getAllGroups();
        setUserGroups((data.groups || []).filter(g => g.is_member).slice(0, 2));
      } catch {
        // Silently fail - show empty state
      } finally {
        setGroupsLoading(false);
      }
    }
    loadGroups();
  }, []);

  const navigateToTab = (tabName: string) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate(tabName);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        showLogo
        showProfile
        transparent
        onProfile={() => navigation.navigate('Profile')}
        rightAction={
          <TouchableOpacity
            style={styles.postButton}
            onPress={() => navigation.navigate('Post')}
            accessibilityLabel="New post"
          >
            <Ionicons name="create-outline" size={22} color={colors.onPrimary} />
          </TouchableOpacity>
        }
      />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting Section */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingTitle}>
              Hello{firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={styles.greetingSubtitle}>How can I help you today?</Text>
          </View>

          {/* AI Search Bar (Hero Element) */}
          <AnimatedPressable
            style={styles.chatInput}
            onPress={() => navigation.navigate('AIChat')}
            haptics="light"
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
            <Text style={styles.chatInputPlaceholder}>Ask the assistant...</Text>
            <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
          </AnimatedPressable>

          {/* Visa Experiences Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="search" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Visa Experiences</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('VisaExperiences')}>
                <Text style={styles.seeAllLink}>See all</Text>
              </TouchableOpacity>
            </View>

            <AnimatedPressable
              style={styles.sectionCta}
              onPress={() => navigation.navigate('VisaExperiences')}
              haptics="light"
            >
              <Text style={styles.sectionCtaText}>Search real visa journeys</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primary} />
            </AnimatedPressable>

            {PREVIEW_EXPERIENCES.map((exp) => (
              <AnimatedPressable
                key={exp.case_id}
                style={styles.inlinePreviewCard}
                onPress={() => navigation.navigate('VisaExperiences')}
                haptics="light"
              >
                <View style={styles.previewBadges}>
                  {exp.outcome && (
                    <View style={styles.outcomeBadge}>
                      <Text style={styles.outcomeBadgeText}>{exp.outcome}</Text>
                    </View>
                  )}
                  {exp.visa.slice(0, 2).map((v) => (
                    <View key={v} style={styles.visaBadge}>
                      <Text style={styles.visaBadgeText}>{v}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.previewTitle} numberOfLines={1}>{exp.title}</Text>
              </AnimatedPressable>
            ))}
          </View>

          {/* Your Groups Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="people" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Your Groups</Text>
              </View>
              <TouchableOpacity onPress={() => navigateToTab('Find')}>
                <Text style={styles.seeAllLink}>See all</Text>
              </TouchableOpacity>
            </View>

            {groupsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : userGroups.length > 0 ? (
              userGroups.map((group) => (
                <AnimatedPressable
                  key={group.group_id}
                  style={styles.previewRow}
                  onPress={() => navigation.navigate('GroupChat', { groupId: group.group_id, groupName: group.name })}
                  haptics="light"
                >
                  <View style={styles.groupIcon}>
                    <Ionicons name="people" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.previewContent}>
                    <Text style={styles.previewRowTitle} numberOfLines={1}>{group.name}</Text>
                    <Text style={styles.previewSubtitle}>
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
                </AnimatedPressable>
              ))
            ) : null}

            <AnimatedPressable
              style={styles.sectionCta}
              onPress={() => navigateToTab('Find')}
              haptics="light"
            >
              <Ionicons name="search" size={18} color={colors.primary} />
              <Text style={styles.sectionCtaText}>Find people like you</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </AnimatedPressable>
          </View>

          {/* Community Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="chatbubbles" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Community</Text>
              </View>
              <TouchableOpacity onPress={() => navigateToTab('Community')}>
                <Text style={styles.seeAllLink}>See all</Text>
              </TouchableOpacity>
            </View>

            {PREVIEW_THREADS.map((thread) => (
              <AnimatedPressable
                key={thread.id}
                style={styles.threadRow}
                onPress={() => navigateToTab('Community')}
                haptics="light"
              >
                <View style={styles.threadMeta}>
                  {thread.tags.slice(0, 1).map((tag) => (
                    <View key={tag} style={styles.threadTag}>
                      <Text style={styles.threadTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.previewRowTitle} numberOfLines={1}>{thread.title}</Text>
                <Text style={styles.previewSubtitle}>
                  {thread.views} views · {thread.comments} replies
                </Text>
              </AnimatedPressable>
            ))}

            <AnimatedPressable
              style={styles.sectionCta}
              onPress={() => navigateToTab('Community')}
              haptics="light"
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionCtaText}>Browse discussions</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </AnimatedPressable>
          </View>

          {/* Bottom padding for tab bar */}
          <View style={{ height: spacing.xl * 2 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  safeArea: {
    flex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  // Greeting Section
  greetingSection: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  greetingTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 24,
    color: colors.onSurface,
  },
  greetingSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  // AI Search Bar (Hero)
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.sm,
    ...shadows.level1,
  },
  chatInputPlaceholder: {
    flex: 1,
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 15,
    color: colors.onSurfaceVariant,
  },
  // Reusable section card style
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    marginTop: spacing.lg,
    ...shadows.level1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 14,
    color: colors.onSurface,
  },
  seeAllLink: {
    fontFamily: 'NunitoSans_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  sectionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primaryContainer,
  },
  sectionCtaText: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 14,
    color: colors.onPrimaryContainer,
    flex: 1,
  },
  // Visa experiences inline cards
  inlinePreviewCard: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  previewBadges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.xs,
  },
  outcomeBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  outcomeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSecondaryContainer,
  },
  visaBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  visaBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onPrimaryContainer,
  },
  previewTitle: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 14,
    color: colors.onSurface,
  },
  // Groups preview rows
  loadingRow: {
    padding: spacing.md,
    alignItems: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    flex: 1,
  },
  previewRowTitle: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 14,
    color: colors.onSurface,
  },
  previewSubtitle: {
    fontFamily: 'NunitoSans_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  // Community thread rows
  threadRow: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  threadMeta: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  threadTag: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  threadTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onPrimaryContainer,
  },
});

export default HomeScreen;
