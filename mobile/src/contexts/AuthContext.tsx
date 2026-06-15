import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithCredential,
  GoogleAuthProvider,
  AuthError,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { auth } from '../config/firebase';
import { registerBackendUser, setActiveUserId, setIdToken } from '../services/apiService';

// Configure Google Sign-In
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDevMode: boolean;
  hasCompletedOnboarding: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  enableDevMode: () => Promise<void>;
  disableDevMode: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_MODE_KEY = 'proceedings_dev_mode';
const ONBOARDING_COMPLETE_KEY = 'proceedings_onboarding_complete';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Check for dev mode and onboarding status on mount
  useEffect(() => {
    async function checkStoredState() {
      try {
        const [devMode, onboardingComplete] = await Promise.all([
          AsyncStorage.getItem(DEV_MODE_KEY),
          AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
        ]);
        if (devMode === 'true') {
          setIsDevMode(true);
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        // Register the uid with the backend (idempotent) and use it as X-User-Id.
        const username =
          firebaseUser.displayName?.trim() || firebaseUser.email?.split('@')[0] || '';
        void registerBackendUser(firebaseUser.uid, username);
      }
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
    } catch (error) {
      if (isErrorWithCode(error)) {
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            console.log('Google Sign-In cancelled by user');
            return; // Don't throw, user cancelled
          case statusCodes.IN_PROGRESS:
            throw new Error('Google Sign-In is already in progress');
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
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

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await disableDevMode();
      await setActiveUserId(null); // stop sending the old uid as X-User-Id
      // Reset onboarding state for next user
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out');
    }
  };

  const enableDevMode = async () => {
    try {
      await AsyncStorage.setItem(DEV_MODE_KEY, 'true');
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

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDevMode,
        hasCompletedOnboarding,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        enableDevMode,
        disableDevMode,
        completeOnboarding,
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
