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
import { Card, Badge, Button } from '../components';
import { colors, spacing, borderRadius } from '../constants/theme';
import { caseDetail } from '../data/mockData';

export function CaseDetailsScreen({ navigation }: any) {
  const [expandedSources, setExpandedSources] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Case Details</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={22} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <Badge variant="success">{caseDetail.status}</Badge>
          <Text style={styles.category}>{caseDetail.category}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{caseDetail.title}</Text>
        <Text style={styles.description}>{caseDetail.description}</Text>

        {/* Verified By */}
        <Card style={styles.verifiedCard}>
          <View style={styles.verifiedRow}>
            <View style={styles.verifiedInfo}>
              <Text style={styles.verifiedLabel}>Verified by {caseDetail.verifiedBy}</Text>
              <Text style={styles.verifiedTitle}>{caseDetail.verifiedTitle}</Text>
              <Text style={styles.verifiedExp}>{caseDetail.verifiedExperience}</Text>
            </View>
            <Button variant="secondary" size="sm">View</Button>
          </View>
        </Card>

        {/* What Worked Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-circle" size={24} color={colors.statusResolved} />
            <Text style={styles.sectionTitle}>What Worked</Text>
          </View>
          <Text style={styles.sectionText}>{caseDetail.whatWorked.summary}</Text>

          <View style={styles.checklist}>
            {caseDetail.whatWorked.checklist.map((item, index) => (
              <View key={index} style={styles.checkItem}>
                <Ionicons
                  name={item.checked ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={item.checked ? colors.statusResolved : colors.outline}
                />
                <Text style={styles.checkText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Resolution Timeline */}
        <Card style={styles.sectionCard}>
          <Text style={styles.timelineTitle}>Resolution Timeline</Text>

          {caseDetail.timeline.map((step, index) => (
            <View key={index} style={styles.timelineStep}>
              <View style={styles.timelineIndicator}>
                <View style={styles.timelineDot} />
                {index < caseDetail.timeline.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.stepTitle}>
                  Step {step.step}: {step.title}
                </Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Official Sources */}
        <TouchableOpacity
          style={styles.sourcesHeader}
          onPress={() => setExpandedSources(!expandedSources)}
        >
          <Ionicons name="link-outline" size={20} color={colors.primary} />
          <Text style={styles.sourcesTitle}>Official Sources & Links</Text>
          <Ionicons
            name={expandedSources ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {expandedSources && (
          <Card style={styles.sourcesList} elevation={0}>
            {caseDetail.officialSources.map((source, index) => (
              <TouchableOpacity key={index} style={styles.sourceItem}>
                <Ionicons
                  name={source.icon === 'document' ? 'document-text-outline' : 'globe-outline'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.sourceText}>{source.title}</Text>
                <Ionicons name="open-outline" size={16} color={colors.outline} />
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Stats Footer */}
        <View style={styles.statsFooter}>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.statText}>{caseDetail.stats.views}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="arrow-up" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.statText}>{caseDetail.stats.upvotes}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.statText}>{caseDetail.stats.comments}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>Documented: October 24, 2023</Text>
          <Text style={styles.disclaimerText}>
            This resolution post contains publicly available information from USCIS processing trends. This is not legal advice. Consult with a law firm or government agency. Consult with an attorney for your specific case.
          </Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Terms of Service</Text>
            <Text style={styles.footerDivider}>•</Text>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
  },
  shareButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.marginMobile,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  category: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginLeft: spacing.base,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.onSurface,
    lineHeight: 28,
    marginBottom: spacing.base,
  },
  description: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  verifiedCard: {
    marginBottom: spacing.md,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedInfo: {
    flex: 1,
  },
  verifiedLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
  },
  verifiedTitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  verifiedExp: {
    fontSize: 12,
    color: colors.outline,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
    marginLeft: spacing.base,
  },
  sectionText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  checklist: {
    gap: spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkText: {
    fontSize: 14,
    color: colors.onSurface,
    marginLeft: spacing.base,
    flex: 1,
  },
  timelineTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.outlineVariant,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  sourcesTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.onSurface,
    marginLeft: spacing.base,
    flex: 1,
  },
  sourcesList: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  sourceText: {
    fontSize: 14,
    color: colors.onSurface,
    marginLeft: spacing.base,
    flex: 1,
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginLeft: 6,
  },
  disclaimer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.outline,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.sm,
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
});

export default CaseDetailsScreen;
