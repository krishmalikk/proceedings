import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithCredential,
  GoogleAuthProvider,
  AuthError,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../config/firebase';

// Required for web browser auth session
WebBrowser.maybeCompleteAuthSession();

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

  // Google Auth configuration
  // expoClientId is used for Expo Go (uses Expo auth proxy with web client ID)
  // iosClientId/androidClientId are for standalone/development builds
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((error) => {
        console.error('Firebase credential sign-in error:', error);
      });
    }
  }, [response]);

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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
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
    if (!request) {
      throw new Error('Google Sign-In is not configured. Please add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env file.');
    }
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google Sign-In error:', error);
      throw new Error('Google Sign-In failed. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      await disableDevMode();
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
