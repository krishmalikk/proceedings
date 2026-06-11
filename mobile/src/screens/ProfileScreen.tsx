import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Header, Card, Badge, Button } from '../components';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { getProfile, getCachedProfile, clearProfileCache } from '../services/apiService';

// Profile data interface matching backend
interface JourneyEntry {
  milestone: string;
  date: string;
  experience: string;
  shared: boolean;
  experience_case_id?: string;
}

interface UserProfile {
  username?: string;
  current_visa_or_greencard_category?: string[];
  visa_applying_for?: string[];
  primary_consulate?: string;
  consulates?: string[];
  tags?: string[];
  key_stages_or_info?: Record<string, string>;
  key_dates?: Record<string, string>;
  background_text?: string;
  journey?: JourneyEntry[];
  created_at?: string;
  updated_at?: string;
}

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());
  const [signingOut, setSigningOut] = useState(false);

  // Load profile with cache-first approach for faster initial display
  const loadProfile = useCallback(async (showRefreshing = false) => {
    setError('');
    if (showRefreshing) {
      setRefreshing(true);
    }
    try {
      const data = await getProfile();
      setProfile(data as UserProfile);
    } catch (e) {
      // Only show error if we don't have cached data
      if (!profile) {
        setError(e instanceof Error ? e.message : 'Could not load profile');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const initProfile = async () => {
      // First, try to show cached data immediately
      const cached = await getCachedProfile();
      if (cached && mounted) {
        setProfile(cached as UserProfile);
        setLoading(false);
      }

      // Then fetch fresh data in background
      try {
        const fresh = await getProfile();
        if (mounted) {
          setProfile(fresh as UserProfile);
        }
      } catch (e) {
        // Only show error if we don't have any data
        if (mounted && !cached) {
          setError(e instanceof Error ? e.message : 'Could not load profile');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    loadProfile(true);
  }, [loadProfile]);

  const toggleMilestone = (index: number) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Clear cached profile data
      await clearProfileCache();
      await signOut();
      // Navigation will auto-redirect to auth screen via MainNavigator
    } catch (e) {
      setError('Failed to sign out');
      setSigningOut(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const hasData = (arr?: string[] | unknown[]) => arr && arr.length > 0;
  const hasObject = (obj?: Record<string, unknown>) => obj && Object.keys(obj).length > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header
          title="Profile"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header
          title="Profile"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button variant="secondary" onPress={loadProfile}>
            Try Again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Profile"
        showBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Account Section */}
        <Card style={styles.section}>
          <View style={styles.accountHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle" size={64} color={colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.username}>
                {profile?.username || 'Anonymous User'}
              </Text>
              {user?.email && (
                <Text style={styles.email}>{user.email}</Text>
              )}
              {profile?.created_at && (
                <Text style={styles.memberSince}>
                  Member since {formatDate(profile.created_at)}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Visa Status Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Visa Status</Text>

          {hasData(profile?.current_visa_or_greencard_category) ? (
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>Current Status</Text>
              <View style={styles.badgeRow}>
                {profile!.current_visa_or_greencard_category!.map((visa, idx) => (
                  <Badge key={idx} variant="primary" style={styles.badge}>
                    {visa}
                  </Badge>
                ))}
              </View>
            </View>
          ) : null}

          {hasData(profile?.visa_applying_for) ? (
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>Applying For</Text>
              <View style={styles.badgeRow}>
                {profile!.visa_applying_for!.map((visa, idx) => (
                  <Badge key={idx} variant="info" style={styles.badge}>
                    {visa}
                  </Badge>
                ))}
              </View>
            </View>
          ) : null}

          {!hasData(profile?.current_visa_or_greencard_category) &&
           !hasData(profile?.visa_applying_for) && (
            <Text style={styles.emptyText}>No visa status set</Text>
          )}
        </Card>

        {/* Consulates Section */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Consulates</Text>

          {profile?.primary_consulate ? (
            <View style={styles.subsection}>
              <View style={styles.consulate}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={styles.primaryConsulate}>
                  {profile.primary_consulate}
                </Text>
                <Badge variant="primary" style={styles.primaryBadge}>Primary</Badge>
              </View>
            </View>
          ) : null}

          {hasData(profile?.consulates) ? (
            <View style={styles.subsection}>
              <View style={styles.badgeRow}>
                {profile!.consulates!
                  .filter(c => c !== profile?.primary_consulate)
                  .map((consulate, idx) => (
                    <Badge key={idx} variant="outline" style={styles.badge}>
                      {consulate}
                    </Badge>
                  ))}
              </View>
            </View>
          ) : null}

          {!profile?.primary_consulate && !hasData(profile?.consulates) && (
            <Text style={styles.emptyText}>No consulates set</Text>
          )}
        </Card>

        {/* Key Information Section */}
        {hasObject(profile?.key_stages_or_info) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Key Information</Text>
            {Object.entries(profile!.key_stages_or_info!).map(([key, value], idx) => (
              <View key={idx} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{formatLabel(key)}</Text>
                <Badge variant="default">{value}</Badge>
              </View>
            ))}
          </Card>
        )}

        {/* Key Dates Section */}
        {hasObject(profile?.key_dates) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Key Dates</Text>
            {Object.entries(profile!.key_dates!).map(([key, value], idx) => (
              <View key={idx} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{formatLabel(key)}</Text>
                <Text style={styles.dateValue}>{formatDate(value)}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Tags Section */}
        {hasData(profile?.tags) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Topics & Interests</Text>
            <View style={styles.badgeRow}>
              {profile!.tags!.map((tag, idx) => (
                <Badge key={idx} variant="outline" style={styles.badge}>
                  {tag}
                </Badge>
              ))}
            </View>
          </Card>
        )}

        {/* Background Section */}
        {profile?.background_text && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Background</Text>
            <Text style={styles.backgroundText}>{profile.background_text}</Text>
          </Card>
        )}

        {/* Journey Timeline Section */}
        {hasData(profile?.journey) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Immigration Journey</Text>
            <View style={styles.timeline}>
              {profile!.journey!.map((entry, idx) => (
                <View key={idx} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  {idx < profile!.journey!.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                  <TouchableOpacity
                    style={styles.timelineContent}
                    onPress={() => toggleMilestone(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.timelineHeader}>
                      <Text style={styles.milestoneName}>
                        {formatLabel(entry.milestone)}
                      </Text>
                      <Ionicons
                        name={expandedMilestones.has(idx) ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.outline}
                      />
                    </View>
                    {entry.date && (
                      <Text style={styles.milestoneDate}>
                        {formatDate(entry.date)}
                      </Text>
                    )}
                    {entry.shared && (
                      <Badge variant="success" style={styles.sharedBadge}>
                        Shared
                      </Badge>
                    )}
                    {expandedMilestones.has(idx) && entry.experience && (
                      <Text style={styles.experienceText}>{entry.experience}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <Button
            variant="secondary"
            fullWidth
            onPress={handleSignOut}
            loading={signingOut}
            icon={<Ionicons name="log-out-outline" size={20} color={colors.onSurface} />}
            iconPosition="left"
          >
            Sign Out
          </Button>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.marginMobile,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.onSurfaceVariant,
    fontSize: typography.bodyMd.fontSize,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  errorText: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.error,
    fontSize: typography.bodyMd.fontSize,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.marginMobile,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  subsection: {
    marginTop: spacing.base,
  },
  subsectionTitle: {
    fontSize: typography.labelMd.fontSize,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  accountInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface,
  },
  email: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  memberSince: {
    fontSize: typography.caption.fontSize,
    color: colors.outline,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  badge: {
    marginBottom: 4,
  },
  emptyText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.outline,
    fontStyle: 'italic',
  },
  consulate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  primaryConsulate: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
    color: colors.onSurface,
    flex: 1,
  },
  primaryBadge: {
    marginLeft: 'auto',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  infoLabel: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  dateValue: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '500',
    color: colors.onSurface,
  },
  backgroundText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurface,
    lineHeight: typography.bodyMd.lineHeight,
  },
  timeline: {
    marginTop: spacing.base,
  },
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
    paddingBottom: spacing.sm,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
    marginRight: spacing.sm,
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 16,
    bottom: 0,
    width: 2,
    backgroundColor: colors.outlineVariant,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.default,
    padding: spacing.sm,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneName: {
    fontSize: typography.bodyMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    flex: 1,
  },
  milestoneDate: {
    fontSize: typography.caption.fontSize,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  sharedBadge: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  experienceText: {
    fontSize: typography.bodyMd.fontSize,
    color: colors.onSurface,
    marginTop: spacing.base,
    lineHeight: typography.bodyMd.lineHeight,
  },
  signOutContainer: {
    marginTop: spacing.md,
  },
  bottomPadding: {
    height: spacing.lg,
  },
});

export default ProfileScreen;
