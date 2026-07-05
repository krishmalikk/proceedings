import React from 'react';
import { Platform, StyleSheet, ViewStyle } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { borderRadius } from '../constants/theme';

/**
 * Apple's official "Sign in with Apple" button (App Store Guideline 4.8).
 *
 * Apple's Human Interface Guidelines require their own button component for the
 * Sign in with Apple affordance — a custom-styled TouchableOpacity is grounds
 * for rejection. This wraps `AppleAuthentication.AppleAuthenticationButton` and
 * renders nothing off-iOS (the API is iOS-only), so callers can drop it in
 * unconditionally next to the Google button.
 */
export function AppleSignInButton({
  onPress,
  type = 'SIGN_IN',
  appearance = 'black',
  style,
}: {
  onPress: () => void;
  type?: 'SIGN_IN' | 'SIGN_UP' | 'CONTINUE';
  /** Button appearance — Apple HIG: use 'white'/'whiteOutline' on dark backgrounds. */
  appearance?: 'black' | 'white' | 'whiteOutline';
  style?: ViewStyle;
}) {
  if (Platform.OS !== 'ios') return null;

  const buttonType =
    type === 'SIGN_UP'
      ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
      : type === 'CONTINUE'
      ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
      : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN;

  const buttonStyle =
    appearance === 'white'
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      : appearance === 'whiteOutline'
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={buttonType}
      buttonStyle={buttonStyle}
      cornerRadius={borderRadius.default}
      style={[styles.button, style]}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 48,
  },
});

export default AppleSignInButton;
