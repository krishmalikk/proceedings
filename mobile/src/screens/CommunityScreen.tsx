import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, FilterChip, ThreadCard } from '../components';
import { colors, spacing, borderRadius } from '../constants/theme';
import { visaFilters, forumThreads, expertSpotlight } from '../data/mockData';

export function CommunityScreen({ navigation }: any) {
  const [selectedFilter, setSelectedFilter] = useState('all');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Community" showLogo={false} showSearch transparent />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Community Forum</Text>
          <Text style={styles.pageSubtitle}>
            Collaborate with fellow applicants and legal experts in a supportive environment.
          </Text>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {visaFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              selected={selectedFilter === filter.value}
              onPress={() => setSelectedFilter(filter.value)}
            />
          ))}
        </ScrollView>

        {/* Thread Cards */}
        <View style={styles.threads}>
          {forumThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              {...thread}
              onPress={() => navigation.navigate('CaseDetails', { caseId: thread.id })}
            />
          ))}
        </View>

        {/* Expert Spotlight */}
        <Card style={styles.spotlightCard}>
          <Text style={styles.spotlightLabel}>EXPERT SPOTLIGHT</Text>
          <Text style={styles.spotlightTitle}>{expertSpotlight.title}</Text>
          <Text style={styles.spotlightText}>{expertSpotlight.description}</Text>
          <Button variant="secondary" style={styles.spotlightButton}>
            {expertSpotlight.buttonText}
          </Button>
        </Card>

        {/* More Threads */}
        <View style={styles.threads}>
          {forumThreads.slice(0, 1).map((thread, index) => (
            <ThreadCard
              key={`more-${thread.id}`}
              {...thread}
              tags={['Green Card', 'Marriage-based', 'Interview']}
              title="My Interview Experience at NYC Field Office"
              timeAgo="10 ago"
              views={112}
              comments={56}
              helpfulCount={42}
              onPress={() => navigation.navigate('CaseDetails', { caseId: thread.id })}
            />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Meridian Community</Text>
          <Text style={styles.footerText}>
            Not legal advice. Meridian is not a law firm or government agency.
          </Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Terms of Service</Text>
            <Text style={styles.footerDivider}>•</Text>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Ionicons name="add" size={20} color={colors.onPrimary} />
        <Text style={styles.fabText}>Post a Question</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  pageSubtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  filtersContainer: {
    marginBottom: spacing.sm,
  },
  filtersContent: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
  },
  threads: {
    paddingHorizontal: spacing.marginMobile,
  },
  spotlightCard: {
    marginHorizontal: spacing.marginMobile,
    marginVertical: spacing.md,
    backgroundColor: colors.inverseSurface,
    borderColor: colors.inverseSurface,
  },
  spotlightLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.outline,
    letterSpacing: 0.5,
    marginBottom: spacing.base,
  },
  spotlightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.inverseOnSurface,
    marginBottom: spacing.base,
  },
  spotlightText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  spotlightButton: {
    backgroundColor: 'transparent',
    borderColor: colors.inverseOnSurface,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: 100,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  footerText: {
    fontSize: 12,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 12,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    fontSize: 12,
    color: colors.outline,
    marginHorizontal: spacing.base,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.marginMobile,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
    marginLeft: 8,
  },
});

export default CommunityScreen;
