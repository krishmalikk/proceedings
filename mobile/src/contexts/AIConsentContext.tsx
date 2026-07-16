import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAIConsentGranted } from '../services/aiConsent';

/**
 * Tracks the user's decision to share data with the third-party AI service
 * (Google Gemini / Google Cloud AI) — App Store Guideline 5.1.1(i) / 5.1.2(i).
 *
 * `decision`:
 *   - `null`      → not decided yet (show the consent screen before any AI use)
 *   - `'granted'` → AI features enabled, data may be sent
 *   - `'declined'`→ AI features disabled, no data sent to the AI backend
 */

const AI_CONSENT_KEY = 'proceedings_ai_consent_v1';

type Decision = 'granted' | 'declined';

interface AIConsentState {
  loading: boolean;
  decision: Decision | null;
  hasAIConsent: boolean; // decision === 'granted'
  grantAIConsent: () => Promise<void>;
  declineAIConsent: () => Promise<void>;
}

const AIConsentContext = createContext<AIConsentState | undefined>(undefined);

export function AIConsentProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AI_CONSENT_KEY)
      .then((v) => {
        const d = v === 'granted' || v === 'declined' ? (v as Decision) : null;
        setDecision(d);
        setAIConsentGranted(d === 'granted');
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = async (d: Decision) => {
    setDecision(d);
    setAIConsentGranted(d === 'granted');
    try {
      await AsyncStorage.setItem(AI_CONSENT_KEY, d);
    } catch {
      // Non-fatal: the in-memory flag still governs this session.
    }
  };

  const grantAIConsent = () => persist('granted');
  const declineAIConsent = () => persist('declined');

  return (
    <AIConsentContext.Provider
      value={{
        loading,
        decision,
        hasAIConsent: decision === 'granted',
        grantAIConsent,
        declineAIConsent,
      }}
    >
      {children}
    </AIConsentContext.Provider>
  );
}

export function useAIConsent(): AIConsentState {
  const ctx = useContext(AIConsentContext);
  if (!ctx) throw new Error('useAIConsent must be used within an AIConsentProvider');
  return ctx;
}
