import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, Input, FilterChip, Select, CaseMatchCard } from '../components';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { caseMatches, applicationStages } from '../data/mockData';

const visaTypeOptions = [
  { label: 'H-1B Special Occupations', value: 'h1b' },
  { label: 'L-1 Intracompany Transfer', value: 'l1' },
  { label: 'EB-2 National Interest Waiver', value: 'eb2niw' },
  { label: 'EB-1 Extraordinary Ability', value: 'eb1' },
];

export function SearchScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visaType, setVisaType] = useState('h1b');
  const [selectedStage, setSelectedStage] = useState('rfe');
  const [resolvedOnly, setResolvedOnly] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header showLogo showSearch showProfile />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="search" size={20} color={colors.onPrimary} />
          </View>
          <Text style={styles.heroTitle}>Find precedents in seconds.</Text>
          <Text style={styles.heroSubtitle}>
            Search our verified database of immigration cases and legal RFEs to match your specific situation.
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="document-text-outline" size={20} color={colors.outline} />
            <Input
              placeholder="Describe your situation..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              containerStyle={styles.searchInput}
              style={styles.searchInputField}
            />
          </View>
          <Button style={styles.searchButton}>Find Matches</Button>
        </View>

        {/* Refine Search */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REFINE SEARCH</Text>

          <Select
            label="Visa Type"
            options={visaTypeOptions}
            value={visaType}
            onChange={setVisaType}
            containerStyle={styles.selectContainer}
          />

          <Text style={styles.fieldLabel}>Application Stage</Text>
          <View style={styles.chips}>
            {applicationStages.map((stage) => (
              <FilterChip
                key={stage.value}
                label={stage.label}
                selected={selectedStage === stage.value}
                onPress={() => setSelectedStage(stage.value)}
              />
            ))}
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Resolved cases only</Text>
            <Switch
              value={resolvedOnly}
              onValueChange={setResolvedOnly}
              trackColor={{ false: colors.outlineVariant, true: colors.primary }}
              thumbColor={colors.surfaceContainerLowest}
            />
          </View>
        </View>

        {/* Pro Tip */}
        <Card style={styles.proTip} elevation={0}>
          <Text style={styles.proTipTitle}>Pro Tip:</Text>
          <Text style={styles.proTipText}>
            Including your specific job title or industry often yields 40% more relevant matches.
          </Text>
        </Card>

        {/* Results */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            Showing <Text style={styles.resultsBold}>24 results</Text> matching your description
          </Text>
          <TouchableOpacity style={styles.sortButton}>
            <Text style={styles.sortText}>Sort by Relevance</Text>
            <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Case Cards */}
        {caseMatches.map((caseItem) => (
          <CaseMatchCard
            key={caseItem.id}
            {...caseItem}
            onPress={() => navigation.navigate('CaseDetails', { caseId: caseItem.id })}
          />
        ))}

        {/* Expert CTA */}
        <Card style={styles.expertCta}>
          <Text style={styles.expertTitle}>Need an Expert Opinion?</Text>
          <Text style={styles.expertText}>
            Our pros can review your specific RFE letter and draft a custom response strategy.
          </Text>
          <Button variant="secondary" style={styles.expertButton}>
            Talk to an Attorney
          </Button>
        </Card>

        <View style={styles.bottomPadding} />
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
  hero: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  searchContainer: {
    paddingHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.default,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
  },
  searchInputField: {
    borderWidth: 0,
  },
  searchButton: {
    alignSelf: 'flex-end',
  },
  section: {
    paddingHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.outline,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  selectContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.onSurface,
  },
  proTip: {
    marginHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.outlineVariant,
  },
  proTipTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  proTipText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  resultsBold: {
    fontWeight: '600',
    color: colors.onSurface,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginRight: 4,
  },
  expertCta: {
    marginHorizontal: spacing.marginMobile,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  expertTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onPrimary,
    marginBottom: spacing.base,
  },
  expertText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  expertButton: {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.surfaceContainerLowest,
  },
  bottomPadding: {
    height: spacing.xl,
  },
});

export default SearchScreen;
