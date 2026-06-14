import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../constants/theme';
import { GroupChat } from '../components';
import { getGroup, GroupInfo } from '../services/apiService';

type RouteParams = {
  GroupChat: {
    groupId: string;
    groupName?: string;
  };
};

export function GroupChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'GroupChat'>>();
  const { groupId, groupName } = route.params;
  const [group, setGroup] = useState<GroupInfo | null>(null);

  // Group composition at a glance (website parity: members shown beside the chat).
  useEffect(() => {
    getGroup(groupId)
      .then(setGroup)
      .catch(() => {});
  }, [groupId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{group?.name || groupName || 'Group Chat'}</Text>
          {!!group?.members?.length && (
            <Text style={styles.members} numberOfLines={1}>
              {group.members.length} member{group.members.length === 1 ? '' : 's'}:{' '}
              {group.members.map((m) => m.username).join(', ')}
            </Text>
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  members: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  chatContainer: {
    flex: 1,
    padding: spacing.marginMobile,
  },
});

export default GroupChatScreen;
