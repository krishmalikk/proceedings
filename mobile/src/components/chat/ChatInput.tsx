import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Orb } from 'react-native-magic-orb';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

// Meridian red gradient colors matching the main orb (brand identity)
const ORB_COLORS: [string, string, string] = [colors.orb.red, colors.orb.pink, colors.orb.purple];

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask anything...' }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={[styles.blurWrapper, shadows.glass]}>
        <BlurView
          intensity={30}
          tint="light"
          style={styles.blur}
        >
          <View style={styles.inputWrapper}>
            {/* Mini orb with red colors */}
            <View style={styles.miniOrbWrap}>
              <Orb
                colors={ORB_COLORS}
                size={28}
                speed={0.5}
                wobbleSpeed={0.3}
                intensity={0.3}
              />
            </View>

            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder={placeholder}
              placeholderTextColor={colors.outline}
              multiline
              maxLength={1000}
              editable={!disabled}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[styles.sendButton, canSend && styles.sendButtonActive]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={canSend ? colors.onPrimary : colors.outline}
              />
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    marginBottom: 90, // Account for FloatingTabBar (70px) + safe area
  },
  blurWrapper: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  blur: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.glass.border,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    paddingVertical: Platform.OS === 'ios' ? spacing.xs : spacing.xs,
    minHeight: 52,
  },
  miniOrbWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.onSurface,
    maxHeight: 100,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
});
