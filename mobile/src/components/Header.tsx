import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';

interface HeaderProps {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  showSearch?: boolean;
  showProfile?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  onProfile?: () => void;
  rightAction?: React.ReactNode;
}

export function Header({
  title,
  showLogo = true,
  showBack = false,
  showSearch = false,
  showProfile = false,
  onBack,
  onSearch,
  onProfile,
  rightAction,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <View style={styles.content}>
        <View style={styles.left}>
          {showBack && (
            <TouchableOpacity onPress={onBack} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          )}
          {showLogo && !showBack && (
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Ionicons name="shield-checkmark" size={20} color={colors.onPrimary} />
              </View>
              <Text style={styles.logoText}>Proceedings</Text>
            </View>
          )}
          {title && !showLogo && (
            <Text style={styles.title}>{title}</Text>
          )}
        </View>

        <View style={styles.right}>
          {showSearch && (
            <TouchableOpacity onPress={onSearch} style={styles.iconButton}>
              <Ionicons name="search" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          )}
          {showProfile && (
            <TouchableOpacity onPress={onProfile} style={styles.profileButton}>
              <Ionicons name="person-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
          )}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface,
  },
  iconButton: {
    padding: 8,
    marginLeft: -8,
  },
  profileButton: {
    marginLeft: 8,
  },
});

export default Header;
