import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthorCard } from '../components/AuthorCard';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing } from '../constants/theme';

type RouteParams = { Author: { uid: string } };

export function AuthorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'Author'>>();
  const uid = route.params?.uid || '';
  const { user, isBlocked, blockUser } = useAuth();

  // Show a block control on other people's profiles (App Store 1.2). Hidden on
  // your own profile and once already blocked.
  const canBlock = !!uid && user?.uid !== uid && !isBlocked(uid);

  const confirmBlock = () => {
    Alert.alert(
      'Block this user?',
      "You won't see their posts, replies, or messages, and they'll be reported to our moderators.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(uid);
              Alert.alert('User blocked', 'You will no longer see content from this user.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert('Could not block user', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Author profile</Text>
        {canBlock ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={confirmBlock}
            accessibilityLabel="Block this user"
          >
            <Ionicons name="ban-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* channel='app' so it renders; full shows background + journey + all postings */}
        <AuthorCard
          authorId={uid}
          channel="app"
          full
          onOpenPosting={(cid) => navigation.push('CaseDetails', { caseId: cid })}
        />
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
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Lora_600SemiBold', fontSize: 17, color: colors.onSurface },
  content: { flex: 1, paddingHorizontal: spacing.md },
});

export default AuthorScreen;
