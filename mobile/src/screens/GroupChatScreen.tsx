import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing } from '../constants/theme';
import { GroupChat } from '../components';

type RouteParams = {
  GroupChat: {
    groupId: string;
    groupName?: string;
  };
};

export function GroupChatScreen() {
  const route = useRoute<RouteProp<RouteParams, 'GroupChat'>>();
  const { groupId, groupName } = route.params;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{groupName || 'Group Chat'}</Text>
      </View>
      <View style={styles.chatContainer}>
        <GroupChat groupId={groupId} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  chatContainer: {
    flex: 1,
    padding: spacing.marginMobile,
  },
});

export default GroupChatScreen;
