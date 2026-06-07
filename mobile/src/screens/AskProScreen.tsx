import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, FilterChip, AttorneyCard } from '../components';
import { colors, spacing, borderRadius } from '../constants/theme';
import { attorneys, specialtyFilters } from '../data/mockData';

export function AskProScreen() {
  const [question, setQuestion] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  const toggleSpecialty = (value: string) => {
    if (selectedSpecialties.includes(value)) {
      setSelectedSpecialties(selectedSpecialties.filter((s) => s !== value));
    } else {
      setSelectedSpecialties([...selectedSpecialties, value]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header showLogo showSearch />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ask Card */}
        <Card style={styles.askCard}>
          <Text style={styles.askTitle}>Ask an Immigration Pro</Text>
          <Text style={styles.askSubtitle}>
            Get expert advice from verified attorneys and consultants on your specific case.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Describe your situation in a few sentences..."
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={4}
              value={question}
              onChangeText={setQuestion}
              textAlignVertical="top"
            />
            <View style={styles.confidentialBadge}>
              <Ionicons name="lock-closed" size={12} color={colors.outline} />
              <Text style={styles.confidentialText}>Confidential</Text>
            </View>
          </View>

          <Text style={styles.filterLabel}>Select Case Specialty</Text>
          <View style={styles.chips}>
            {specialtyFilters.map((specialty) => (
              <FilterChip
                key={specialty.value}
                label={specialty.label}
                selected={selectedSpecialties.includes(specialty.value)}
                onPress={() => toggleSpecialty(specialty.value)}
              />
            ))}
          </View>

          <Button
            fullWidth
            icon={<Ionicons name="send" size={18} color={colors.onPrimary} />}
          >
            Post Question to Community Pros
          </Button>
        </Card>

        {/* Verified Professionals Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verified Professionals</Text>
          <Text style={styles.viewAll}>View All →</Text>
        </View>

        {/* Attorney Cards */}
        <View style={styles.attorneys}>
          {attorneys.map((attorney) => (
            <AttorneyCard key={attorney.id} {...attorney} />
          ))}
        </View>

        {/* Guarantee Card */}
        <Card style={styles.guaranteeCard} elevation={0}>
          <View style={styles.guaranteeHeader}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={styles.guaranteeTitle}>Professional Standard Guarantee</Text>
          </View>
          <Text style={styles.guaranteeText}>
            All professionals listed on Proceedings undergo a rigorous background check and license verification process. Consultations provided through this platform are encrypted and strictly confidential.
          </Text>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Not legal advice. Proceedings is not a law firm or government agency.
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
  content: {
    flex: 1,
  },
  askCard: {
    margin: spacing.marginMobile,
  },
  askTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.base,
  },
  askSubtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  inputContainer: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  textInput: {
    padding: spacing.sm,
    fontSize: 15,
    color: colors.onSurface,
    minHeight: 100,
  },
  confidentialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  confidentialText: {
    fontSize: 12,
    color: colors.outline,
    marginLeft: 4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface,
    marginBottom: spacing.base,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface,
  },
  viewAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  attorneys: {
    paddingHorizontal: spacing.marginMobile,
  },
  guaranteeCard: {
    marginHorizontal: spacing.marginMobile,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 0,
    marginTop: spacing.sm,
  },
  guaranteeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  guaranteeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
    marginLeft: spacing.base,
    flex: 1,
  },
  guaranteeText: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
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

export default AskProScreen;
