import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { GroupChat } from '../components';
import { getGroup, leaveGroup, GroupInfo } from '../services/apiService';

type RouteParams = {
  GroupChat: {
    groupId: string;
    groupName?: string;
  };
};

export function GroupChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'GroupChat'>>();
  const { groupId, groupName } = route.params;
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Group composition at a glance (website parity: members shown beside the chat).
  useEffect(() => {
    getGroup(groupId)
      .then(setGroup)
      .catch(() => {});
  }, [groupId]);

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveGroup(groupId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to leave group');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const handleMemberPress = (userId: string) => {
    setShowMembersModal(false);
    navigation.navigate('AuthorProfile', { userId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setShowMembersModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.title} numberOfLines={1}>
            {group?.name || groupName || 'Group Chat'}
          </Text>
          {!!group?.members?.length && (
            <Text style={styles.membersLink}>
              {group.members.length} member{group.members.length === 1 ? '' : 's'} · Tap to view
            </Text>
          )}
        </TouchableOpacity>
        {group?.is_member && (
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveGroup}
            disabled={leaving}
          >
            {leaving ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="exit-outline" size={22} color={colors.error} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chatContainer}>
        <GroupChat groupId={groupId} />
      </View>

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Members</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowMembersModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.membersList}>
            {group?.members?.map((member) => (
              <TouchableOpacity
                key={member.user_id}
                style={styles.memberRow}
                onPress={() => handleMemberPress(member.user_id)}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>
                    {member.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.memberName}>{member.username}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
  },
  membersLink: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 2,
  },
  leaveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
    padding: spacing.marginMobile,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  modalClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersList: {
    flex: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  memberInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimaryContainer,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.onSurface,
  },
});

export default GroupChatScreen;
