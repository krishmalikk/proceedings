import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { getGroup, leaveGroup, inviteToGroup, renameGroup, deleteGroup, GroupInfo } from '../services/apiService';

type RouteParams = {
  GroupChat: {
    groupId: string;
    groupName?: string;
  };
};

// Relative "X ago" for data-freshness (mirrors GroupChat/PostingCard).
function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export function GroupChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'GroupChat'>>();
  const { groupId, groupName } = route.params;
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // rename (admin only)
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // invite (any member)
  const [inviteHandle, setInviteHandle] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  const loadGroup = () => {
    getGroup(groupId)
      .then((g) => {
        setGroup(g);
        setNameDraft(g.name);
        setDescDraft(g.description || '');
      })
      .catch(() => {});
  };

  // Group composition at a glance (website parity: members shown beside the chat).
  useEffect(() => {
    loadGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Delete this group for everyone? This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGroup(groupId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete group');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleMemberPress = (userId: string) => {
    setShowMembersModal(false);
    // 'Author' is the uid-based profile route registered in every stack
    // (there is no 'AuthorProfile' route — the old name silently no-opped).
    navigation.navigate('Author', { uid: userId });
  };

  const saveRename = async () => {
    if (!nameDraft.trim()) return;
    setSaving(true);
    try {
      const updated = await renameGroup(groupId, { name: nameDraft.trim(), description: descDraft.trim() });
      setGroup(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not rename group');
    } finally {
      setSaving(false);
    }
  };

  const submitInvite = async () => {
    if (!inviteHandle.trim()) return;
    setInviting(true);
    setInviteMsg('');
    try {
      const updated = await inviteToGroup(groupId, inviteHandle.trim());
      setGroup(updated);
      setInviteHandle('');
      setInviteMsg('Added to the group.');
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'Could not invite that handle');
    } finally {
      setInviting(false);
    }
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
            accessibilityLabel="Leave Group"
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

      {/* Members Modal — also group metadata, rename (admin), invite (any member) */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Group Info</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowMembersModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.membersList}>
            <View style={styles.metaSection}>
              {editing ? (
                <>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    maxLength={100}
                    style={styles.editInput}
                  />
                  <TextInput
                    value={descDraft}
                    onChangeText={setDescDraft}
                    maxLength={500}
                    placeholder="What's this group for?"
                    placeholderTextColor={colors.onSurfaceVariant}
                    multiline
                    style={[styles.editInput, styles.editTextarea]}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={saveRename} disabled={saving || !nameDraft.trim()} style={styles.saveButton}>
                      <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setEditing(false); setNameDraft(group?.name || ''); setDescDraft(group?.description || ''); }}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.metaTitleRow}>
                    <Text style={styles.groupName}>{group?.name}</Text>
                    {group?.is_admin && (
                      <TouchableOpacity onPress={() => setEditing(true)}>
                        <Text style={styles.renameLink}>Rename</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!group?.description && <Text style={styles.groupDescription}>{group.description}</Text>}
                </>
              )}
              {group?.created_at && (
                <Text style={styles.groupDates}>
                  Created {timeAgo(group.created_at) || group.created_at}
                  {group.last_activity_at ? ` · Last activity ${timeAgo(group.last_activity_at)}` : ''}
                </Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>Members ({group?.members?.length || 0})</Text>
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
                {member.user_id === group.created_by && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ))}

            <View style={styles.inviteSection}>
              <Text style={styles.sectionLabel}>Invite someone</Text>
              <Text style={styles.inviteHint}>Know someone else in the same boat? Add them by handle.</Text>
              <View style={styles.inviteRow}>
                <TextInput
                  value={inviteHandle}
                  onChangeText={setInviteHandle}
                  placeholder="their handle…"
                  placeholderTextColor={colors.onSurfaceVariant}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.inviteInput}
                />
                <TouchableOpacity onPress={submitInvite} disabled={inviting || !inviteHandle.trim()} style={styles.inviteButton}>
                  <Text style={styles.inviteButtonText}>{inviting ? '…' : 'Invite'}</Text>
                </TouchableOpacity>
              </View>
              {!!inviteMsg && <Text style={styles.inviteMsg}>{inviteMsg}</Text>}
            </View>

            {group?.is_admin && (
              <View style={styles.deleteSection}>
                <TouchableOpacity onPress={handleDeleteGroup} disabled={deleting} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>{deleting ? 'Deleting…' : 'Delete Group'}</Text>
                </TouchableOpacity>
              </View>
            )}
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
    fontFamily: 'Lora_600SemiBold',
    fontSize: 17,
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
  metaSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  metaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.onSurface,
  },
  renameLink: {
    fontSize: 14,
    color: colors.primary,
  },
  groupDescription: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  groupDates: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  editInput: {
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  editTextarea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  cancelButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
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
  adminBadge: {
    backgroundColor: colors.primaryContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onPrimaryContainer,
  },
  inviteSection: {
    paddingBottom: spacing.lg,
  },
  inviteHint: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  inviteInput: {
    flex: 1,
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inviteButton: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    justifyContent: 'center',
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  inviteMsg: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  deleteSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  deleteButton: {
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
});

export default GroupChatScreen;
