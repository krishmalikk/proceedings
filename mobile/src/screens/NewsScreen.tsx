import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, NewsCard } from '../components';
import { colors, spacing, borderRadius } from '../constants/theme';
import { newsArticles } from '../data/mockData';

export function NewsScreen() {
  const [showPolicyOnly, setShowPolicyOnly] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header showLogo showSearch />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Tailored News</Text>
          <Text style={styles.pageSubtitle}>
            Insights for your H-1B & EB-2 status.
          </Text>
        </View>

        {/* Smart Feed Card */}
        <Card style={styles.smartFeedCard} elevation={0}>
          <View style={styles.smartFeedHeader}>
            <Ionicons name="flash" size={18} color={colors.secondary} />
            <Text style={styles.smartFeedTitle}>Smart Feed Active</Text>
          </View>
          <Text style={styles.smartFeedText}>
            We're prioritizing news about H-1B extensions and EB-2 category priority dates based on your profile.
          </Text>
        </Card>

        {/* Policy Toggle */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Show official policy changes only</Text>
          <Switch
            value={showPolicyOnly}
            onValueChange={setShowPolicyOnly}
            trackColor={{ false: colors.outlineVariant, true: colors.primary }}
            thumbColor={colors.surfaceContainerLowest}
          />
        </View>

        {/* News Cards */}
        <View style={styles.newsContainer}>
          {newsArticles.map((article) => (
            <NewsCard key={article.id} {...article} />
          ))}
        </View>

        {/* Load More */}
        <Button variant="secondary" style={styles.loadMoreButton}>
          Load older updates
        </Button>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Not legal advice. Meridian is not a law firm or government agency.
          </Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Terms of Service</Text>
            <Text style={styles.footerDivider}>•</Text>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </View>
          <Text style={styles.copyright}>© 2026 Meridian Inc.</Text>
        </View>
      </ScrollView>
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
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
  },
  smartFeedCard: {
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
    backgroundColor: colors.secondaryContainer,
    borderWidth: 0,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    borderRadius: borderRadius.default,
  },
  smartFeedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  smartFeedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSecondaryContainer,
    marginLeft: spacing.base,
  },
  smartFeedText: {
    fontSize: 13,
    color: colors.onSecondaryContainer,
    lineHeight: 19,
    opacity: 0.85,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.onSurface,
  },
  newsContainer: {
    paddingHorizontal: spacing.marginMobile,
  },
  loadMoreButton: {
    marginHorizontal: spacing.marginMobile,
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.xl,
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
    marginBottom: spacing.base,
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
  copyright: {
    fontSize: 12,
    color: colors.outline,
  },
});

export default NewsScreen;
