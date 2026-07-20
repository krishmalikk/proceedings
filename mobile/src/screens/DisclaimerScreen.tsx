import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const LAST_UPDATED = 'July 3, 2026';
const SUPPORT_EMAIL = 'support@meridianjourney.ai';

// Standard legal disclaimer - mirrors the website /disclaimer page. Plain,
// static content. NOTE: boilerplate; have counsel review before public launch.
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: '1. No Legal Advice',
    body:
      'The information provided on or through the Service - including articles, search results, ' +
      'AI-generated responses, tags, summaries, and any content posted by users - is provided for ' +
      'general informational purposes only and does NOT constitute legal advice. Nothing on the ' +
      'Service is intended to be, and should not be relied upon as, a substitute for advice from a ' +
      'licensed attorney regarding your specific situation. Any message, response, opinion, ' +
      'suggestion, or “advice” posted, generated, or shared through the Service does not constitute ' +
      'legal advice and must not be treated as such.',
  },
  {
    heading: '2. No Attorney-Client Relationship',
    body:
'Use of the Service does not create an attorney-client relationship between you and ' +
      'Meridian, its owners, operators, employees, contributors, or any other user. ' +
      'Communications made through the Service are not protected by the attorney-client privilege ' +
      'or any other privilege, and are not confidential. Do not send or post sensitive, ' +
      'privileged, or personally identifying information through the Service.',
  },
  {
    heading: '3. User-Generated Content',
    body:
      'The Service includes content created by other users, such as postings, replies, group ' +
      'messages, and shared experiences. This content reflects the personal views and experiences ' +
'of the individuals who posted it. Meridian does not author, verify, endorse, or guarantee ' +
      'the accuracy, completeness, or reliability of any user-generated content. Other users are ' +
      'not attorneys acting on your behalf, and any guidance they offer is peer commentary - not ' +
      'legal advice. You rely on user-generated content at your own risk.',
  },
  {
    heading: '4. Community Guidelines — Zero Tolerance for Objectionable Content',
    body:
      'By using the Service you agree to this End User License Agreement (EULA) and our community ' +
      'guidelines. There is ZERO TOLERANCE for objectionable content or abusive behavior. You will ' +
      'not post, upload, or transmit any content that is unlawful, harassing, threatening, abusive, ' +
      'hateful, defamatory, obscene, sexually explicit, or that promotes violence or discrimination, ' +
      'and you will not harass, bully, impersonate, or abuse other users. Objectionable content is ' +
      'filtered on submission and may be automatically blocked. You can flag/report any content and ' +
      'block any user directly in the app (via the "..." menu on a posting, reply, or message). ' +
      'Reported content is reviewed and, where it violates these terms, removed within 24 hours, and ' +
      'the responsible user may be suspended or permanently removed. We may remove content and ' +
      'terminate accounts that violate these terms at our sole discretion. To report abuse you may ' +
      'also contact us at ' + SUPPORT_EMAIL + '.',
  },
  {
    heading: '5. AI-Generated Information',
    body:
      'Certain features of the Service use automated and artificial-intelligence systems to ' +
      'generate responses or summaries. These outputs may be incomplete, outdated, or incorrect, ' +
      'and may not reflect current law or your specific circumstances. AI-generated information is ' +
      'provided for general informational purposes only, does not constitute legal advice, and ' +
      'should be independently verified with a qualified attorney before you act on it.',
  },
  {
    heading: '6. Not a Law Firm or Government Agency',
    body:
'Meridian is not a law firm, is not a substitute for an attorney or law firm, and does ' +
      'not practice law. Meridian is not affiliated with, endorsed by, or acting on behalf of ' +
      'U.S. Citizenship and Immigration Services (USCIS), the U.S. Department of State, any court, ' +
      'or any other government agency. Official information should always be confirmed with the ' +
      'relevant government source.',
  },
  {
    heading: '7. No Warranty; Accuracy Not Guaranteed',
    body:
      'Immigration law and government procedures change frequently and vary by individual ' +
      'circumstances and jurisdiction. The Service is provided on an “as is” and “as available” ' +
      'basis without warranties of any kind, whether express or implied, including but not limited ' +
      'to warranties of accuracy, completeness, timeliness, fitness for a particular purpose, or ' +
      'non-infringement. We do not warrant that the information on the Service is current, correct, ' +
      'or applicable to your situation.',
  },
  {
    heading: '8. No Endorsement of Third Parties',
    body:
      'Any reference to, or listing of, attorneys, consultants, professionals, organizations, or ' +
      'external resources is provided for convenience only and does not constitute an endorsement, ' +
      'recommendation, or guarantee of any third party or their services. You are solely ' +
      'responsible for evaluating and selecting any professional you choose to engage.',
  },
  {
    heading: '9. Limitation of Liability',
    body:
'To the fullest extent permitted by law, Meridian and its owners, operators, employees, ' +
      'and contributors shall not be liable for any loss, damage, or harm of any kind arising out ' +
      'of or in connection with your use of, or reliance on, the Service or any content provided ' +
      'through it. Your use of the Service is entirely at your own risk.',
  },
  {
    heading: '10. Consult a Licensed Attorney',
    body:
      'For advice about your specific immigration matter, you should consult a licensed immigration ' +
      'attorney admitted to practice in the relevant jurisdiction. Do not delay seeking ' +
      'professional legal advice, or disregard such advice, because of anything you have read or ' +
      'received through the Service.',
  },
  {
    heading: '11. Changes to This Disclaimer',
    body:
      'We may update this disclaimer from time to time. Any changes will be effective upon posting ' +
      'within the Service, with the “Last updated” date revised accordingly. Your continued use of ' +
      'the Service after changes are posted constitutes your acceptance of the revised disclaimer.',
  },
];

export function DisclaimerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal Disclaimer</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>LEGAL</Text>
        <Text style={styles.title}>Legal Disclaimer</Text>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <Text style={styles.intro}>
Please read this disclaimer carefully before using Meridian (the "Site," "App," or
          “Service”). By accessing or using the Service, you acknowledge that you have read,
          understood, and agree to be bound by this disclaimer. If you do not agree, do not use the
          Service.
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.contactBox}>
          <Text style={styles.contactText}>Questions about this disclaimer? Contact us at </Text>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={styles.contactLink}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Lora_600SemiBold', fontSize: 17, color: colors.onSurface },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.md },
  overline: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.headlineLg.fontSize,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 2,
  },
  updated: {
    fontSize: typography.caption.fontSize,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  intro: {
    fontSize: typography.bodyMd.fontSize,
    lineHeight: 22,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.md },
  sectionHeading: {
    fontSize: typography.headlineMd.fontSize,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    fontSize: typography.bodyMd.fontSize,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
  },
  contactBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  contactText: { fontSize: typography.caption.fontSize, color: colors.onSurfaceVariant },
  contactLink: {
    fontSize: typography.caption.fontSize,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default DisclaimerScreen;
