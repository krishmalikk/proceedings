// API Service for Proceedings Mobile
// Connects to the same backend API as the website

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://immiguide-api-971592620882.us-central1.run.app';

export interface Source {
  chunk_id: string;
  text: string;
  source: string;
  labels: string[];
  score: number;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  is_fallback: boolean;
  id: string;
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  sources: string[];
  labels: string[];
  created_at: string | null;
  is_fallback: boolean;
  helpful: boolean | null;
}

/**
 * Submit an immigration question to the AI
 */
export async function askQuestion(question: string): Promise<AskResponse> {
  const response = await fetch(`${API_URL}/api/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get recent Q&A history
 */
export async function getQAHistory(limit = 20, offset = 0): Promise<{ items: QAItem[] }> {
  const response = await fetch(
    `${API_URL}/api/qa?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Q&A history: ${response.status}`);
  }

  return response.json();
}

/**
 * Submit feedback on an answer
 */
export async function submitFeedback(qaId: string, helpful: boolean): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_URL}/api/qa/${qaId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ helpful }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit feedback: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if the API is healthy
 */
export async function checkHealth(): Promise<{ status: string; chunks_loaded: number }> {
  const response = await fetch(`${API_URL}/api/health`);
  return response.json();
}
