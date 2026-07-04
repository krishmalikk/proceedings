import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  User,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithCredential,
  updateProfile as updateFirebaseProfile,
  GoogleAuthProvider,
  OAuthProvider,
  AuthError,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { registerBackendUser, setActiveUserId, setIdToken, checkEmailVerified, getProfile, getBlockedUsers, blockUser as apiBlockUser } from '../services/apiService';

// Dev mode uses a consistent mock user ID so API calls work during testing
const DEV_MODE_USER_ID = 'dev-mode-user-12345';

// Dynamically import Google Sign-In to avoid crashes in Expo Go
let GoogleSignin: any = null;
let isSuccessResponse: any = null;
let isErrorWithCode: any = null;
let statusCodes: any = null;

try {
  const googleSignIn = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignIn.GoogleSignin;
  isSuccessResponse = googleSignIn.isSuccessResponse;
  isErrorWithCode = googleSignIn.isErrorWithCode;
  statusCodes = googleSignIn.statusCodes;

  // Configure Google Sign-In only if available
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
} catch (e) {
  console.log('Google Sign-In not available (running in Expo Go)');
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDevMode: boolean;
  isEmailVerified: boolean;
  hasSeenWelcome: boolean;
  hasCompletedOnboarding: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  // UGC safety (App Store Guideline 1.2): the set of uids the current user has
  // blocked, so blocked authors' content can be hidden from feeds instantly.
  blockedUids: Set<string>;
  isBlocked: (uid?: string) => boolean;
  blockUser: (uid: string) => Promise<void>;
  refreshBlocks: () => Promise<void>;
  enableDevMode: () => Promise<void>;
  disableDevMode: () => Promise<void>;
  completeWelcome: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setEmailVerified: (verified: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_MODE_KEY = 'proceedings_dev_mode';
const WELCOME_SEEN_KEY = 'proceedings_welcome_seen';
const ONBOARDING_COMPLETE_KEY = 'proceedings_onboarding_complete';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isEmailVerified, setIsEmailVerifiedState] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());

  // Check for dev mode and onboarding status on mount
  useEffect(() => {
    async function checkStoredState() {
      try {
        const [devMode, welcomeSeen, onboardingComplete] = await Promise.all([
          AsyncStorage.getItem(DEV_MODE_KEY),
          AsyncStorage.getItem(WELCOME_SEEN_KEY),
          AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
        ]);
        if (devMode === 'true') {
          setIsDevMode(true);
          // Restore the dev mode user ID so API calls work
          await setActiveUserId(DEV_MODE_USER_ID);
          // In dev mode, there's no Firebase user so onAuthStateChanged won't set loading=false
          // We need to set it here so the app doesn't stay on the loading screen
          setLoading(false);
        }
        if (welcomeSeen === 'true') {
          setHasSeenWelcome(true);
        }
        if (onboardingComplete === 'true') {
          setHasCompletedOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking stored state:', error);
      }
    }
    checkStoredState();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Register the uid with the backend (idempotent) and use it as X-User-Id.
        const username =
          firebaseUser.displayName?.trim() || firebaseUser.email?.split('@')[0] || '';
        await registerBackendUser(firebaseUser.uid, username);

        // Load the user's block list so blocked authors are hidden from feeds
        // immediately (best-effort — never blocks sign-in).
        getBlockedUsers().then((ids) => setBlockedUids(new Set(ids))).catch(() => {});

        // Check email verification status
        // Federated sign-in (Google / Apple) users are auto-verified — Apple and
        // Google have already verified the email (Apple may relay a private one).
        const isFederatedUser = firebaseUser.providerData?.some(
          (p) => p.providerId === 'google.com' || p.providerId === 'apple.com'
        );
        if (isFederatedUser) {
          setIsEmailVerifiedState(true);
        } else if (firebaseUser.email) {
          // Check with backend if email is verified
          const verified = await checkEmailVerified(firebaseUser.email);
          setIsEmailVerifiedState(verified);
        }

        // Check if user has existing profile data (returning user who completed onboarding)
        // This restores onboarding flags that were cleared on sign-out
        try {
          const profile = await getProfile();
          const hasProfileData = !!profile && (
            ((profile.current_visa_or_greencard_category as string[] | undefined)?.length ?? 0) > 0 ||
            ((profile.visa_applying_for as string[] | undefined)?.length ?? 0) > 0 ||
            ((profile.tags as string[] | undefined)?.length ?? 0) > 0 ||
            ((profile.background_text as string | undefined)?.trim().length ?? 0) > 0 ||
            ((profile.journey as unknown[] | undefined)?.length ?? 0) > 0
          );

          if (hasProfileData) {
            // Restore onboarding completion status for returning users
            await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
            await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
            setHasCompletedOnboarding(true);
            setHasSeenWelcome(true);
          }
        } catch (error) {
          // Profile fetch failed, proceed with normal onboarding check from AsyncStorage
          console.warn('Failed to check existing profile:', error);
        }
      } else {
        setIsEmailVerifiedState(false);
        setBlockedUids(new Set());
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Keep the ID token fresh for API calls (fires on sign-in/out AND hourly refresh)
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
        } catch (error) {
          console.error('Error getting ID token:', error);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw new Error(getAuthErrorMessage((error as AuthError).code));
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw new Error(getAuthErrorMessage((error as AuthError).code));
    }
  };

  const signInWithGoogle = async () => {
    // Check if Google Sign-In is available (not in Expo Go)
    if (!GoogleSignin) {
      throw new Error('Google Sign-In is not available in Expo Go. Use email login or Dev Mode, or create a development build.');
    }

    try {
      // Check if Google Play Services are available (Android only, no-op on iOS)
      await GoogleSignin.hasPlayServices();

      // Sign in with Google
      const response = await GoogleSignin.signIn();

      if (isSuccessResponse(response)) {
        const { idToken } = response.data;
        if (idToken) {
          // Create Firebase credential and sign in
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        } else {
          throw new Error('No ID token received from Google');
        }
      }
    } catch (error: any) {
      if (isErrorWithCode && isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes?.SIGN_IN_CANCELLED:
            console.log('Google Sign-In cancelled by user');
            return; // Don't throw, user cancelled
          case statusCodes?.IN_PROGRESS:
            throw new Error('Google Sign-In is already in progress');
          case statusCodes?.PLAY_SERVICES_NOT_AVAILABLE:
            throw new Error('Google Play Services not available');
          default:
            console.error('Google Sign-In error:', error);
            throw new Error('Google Sign-In failed. Please try again.');
        }
      } else {
        console.error('Google Sign-In error:', error);
        throw new Error('Google Sign-In failed. Please try again.');
      }
    }
  };

  // Sign in with Apple (App Store Guideline 4.8 — the privacy-preserving login
  // required alongside Google). Native flow: Apple issues an identityToken bound
  // to a nonce; we hand it to Firebase via an 'apple.com' OAuthProvider credential
  // (same shape as the Google flow above). iOS-only.
  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Sign in with Apple is only available on iOS.');
    }
    if (!(await AppleAuthentication.isAvailableAsync())) {
      throw new Error('Sign in with Apple is not available on this device.');
    }

    // Firebase requires the RAW nonce; Apple is given its SHA-256 hash.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    try {
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken, fullName } = appleCredential;
      if (!identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const credential = new OAuthProvider('apple.com').credential({
        idToken: identityToken,
        rawNonce,
      });
      const result = await signInWithCredential(auth, credential);

      // Apple returns the user's name ONLY on the first authorization. Capture it
      // onto the Firebase profile so later sessions (and the backend username)
      // have a real display name instead of a blank / relay handle.
      const displayName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (displayName && result.user && !result.user.displayName) {
        try {
          await updateFirebaseProfile(result.user, { displayName });
        } catch {
          // Non-fatal — the account is created; name is a nicety.
        }
      }
    } catch (error: any) {
      // User tapped Cancel on the Apple sheet — not an error worth surfacing.
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        console.log('Sign in with Apple cancelled by user');
        return;
      }
      console.error('Sign in with Apple error:', error);
      throw new Error('Sign in with Apple failed. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      // Clear all local state BEFORE Firebase sign-out to avoid race conditions.
      // Firebase sign-out triggers onAuthStateChanged which causes navigation,
      // so we need everything cleaned up before that happens.
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      await AsyncStorage.removeItem(WELCOME_SEEN_KEY);
      await AsyncStorage.removeItem(DEV_MODE_KEY);
      await setActiveUserId(null); // stop sending the old uid as X-User-Id

      // Update React state before sign-out
      setHasCompletedOnboarding(false);
      setHasSeenWelcome(false);
      setIsDevMode(false);

      // Only call Firebase sign-out if there's actually a Firebase user
      // In dev mode, user is null so we skip this to avoid unnecessary errors
      if (user) {
        await firebaseSignOut(auth);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Don't throw - the sign-out may have partially completed
      // and throwing would leave the app in an inconsistent state
    }
  };

  const enableDevMode = async () => {
    try {
      await AsyncStorage.setItem(DEV_MODE_KEY, 'true');
      // Set a mock user ID so API calls work in dev mode
      await setActiveUserId(DEV_MODE_USER_ID);
      setIsDevMode(true);
    } catch (error) {
      console.error('Error enabling dev mode:', error);
    }
  };

  const disableDevMode = async () => {
    try {
      await AsyncStorage.removeItem(DEV_MODE_KEY);
      setIsDevMode(false);
    } catch (error) {
      console.error('Error disabling dev mode:', error);
    }
  };

  const completeWelcome = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
      setHasSeenWelcome(true);
    } catch (error) {
      console.error('Error completing welcome:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const setEmailVerified = (verified: boolean) => {
    setIsEmailVerifiedState(verified);
  };

  const isBlocked = (uid?: string) => !!uid && blockedUids.has(uid);

  const blockUser = async (uid: string) => {
    const ids = await apiBlockUser(uid);
    setBlockedUids(new Set(ids));
  };

  const refreshBlocks = async () => {
    const ids = await getBlockedUsers();
    setBlockedUids(new Set(ids));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDevMode,
        isEmailVerified,
        hasSeenWelcome,
        hasCompletedOnboarding,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
        blockedUids,
        isBlocked,
        blockUser,
        refreshBlocks,
        enableDevMode,
        disableDevMode,
        completeWelcome,
        completeOnboarding,
        setEmailVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to convert Firebase auth error codes to user-friendly messages
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign in is not enabled.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'An error occurred. Please try again.';
  }
}

export default AuthContext;
