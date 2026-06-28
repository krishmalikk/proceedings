import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { sendVerificationCode, verifyCode } from '../services/apiService';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export function EmailVerificationScreen() {
  const { user, setEmailVerified, signOut } = useAuth();
  const email = user?.email || '';

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Send initial code on mount
  useEffect(() => {
    if (email && !codeSent) {
      handleSendCode();
    }
  }, [email]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when all digits are entered
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === CODE_LENGTH && !code.includes('')) {
      handleVerify();
    }
  }, [code]);

  const handleSendCode = async () => {
    if (!email) return;

    setResendLoading(true);
    setError('');
    try {
      await sendVerificationCode(email);
      setCodeSent(true);
      setResendCooldown(RESEND_COOLDOWN);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send verification code');
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await verifyCode(email, fullCode);
      if (result.verified) {
        setEmailVerified(true);
      } else {
        setError(result.error || 'Invalid code. Please try again.');
        // Clear the code on error
        setCode(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace - go to previous input
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handlePaste = (text: string) => {
    // Handle pasting a full code
    const digits = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    if (digits.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < digits.length; i++) {
        newCode[i] = digits[i];
      }
      setCode(newCode);
      // Focus the next empty input or the last one
      const nextEmpty = newCode.findIndex((d) => !d);
      if (nextEmpty !== -1) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[CODE_LENGTH - 1]?.focus();
      }
    }
  };

  const handleUseDifferentEmail = () => {
    Alert.alert(
      'Use Different Email',
      'This will sign you out. You can sign up again with a different email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  // Mask email for display (k***@example.com)
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const masked = local.length > 1 ? local[0] + '***' : local;
    return `${masked}@${domain}`;
  };

  return (
    <ImageBackground
      source={require('../../assets/email-verification-image.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            {/* Header */}
            <Text style={styles.title}>Confirm your email</Text>
            <Text style={styles.subtitle}>
              We just sent you a verification code to{'\n'}
              <Text style={styles.email}>{maskEmail(email)}</Text>
            </Text>

            {/* Error message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Code inputs */}
            <View style={styles.codeContainer}>
              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={[
                    styles.codeInput,
                    code[index] && styles.codeInputFilled,
                    loading && styles.codeInputDisabled,
                  ]}
                  value={code[index]}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!loading}
                  onFocus={() => {
                    // On paste, the first input receives the full text
                    if (index === 0) {
                      // Check clipboard - handled natively by onChangeText
                    }
                  }}
                />
              ))}
            </View>

            {/* Verify button */}
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading || code.join('').length !== CODE_LENGTH}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.verifyButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            {/* Resend code */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the code? </Text>
              {resendCooldown > 0 ? (
                <Text style={styles.cooldownText}>Resend in {resendCooldown}s</Text>
              ) : (
                <TouchableOpacity onPress={handleSendCode} disabled={resendLoading}>
                  {resendLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.resendLink}>Resend Code</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Use different email */}
            <TouchableOpacity style={styles.differentEmailButton} onPress={handleUseDifferentEmail}>
              <Text style={styles.differentEmailText}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.marginMobile,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  email: {
    fontWeight: '600',
    color: colors.onSurface,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.default,
    marginBottom: spacing.md,
    gap: 8,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.onErrorContainer,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerLowest,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.onSurface,
  },
  codeInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  codeInputDisabled: {
    opacity: 0.6,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.default,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resendText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  cooldownText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontWeight: '500',
  },
  differentEmailButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  differentEmailText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
});

export default EmailVerificationScreen;
