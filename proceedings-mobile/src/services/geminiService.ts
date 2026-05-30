// Gemini AI Service for Proceedings
import { GoogleGenerativeAI, ChatSession, Content } from '@google/generative-ai';

// Initialize with API key from environment
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;
let chatSession: ChatSession | null = null;

const SYSTEM_PROMPT = `You are Proceedings AI, a helpful assistant for US immigration questions. You help users:
1. Search for immigration experiences (visa interviews, case timelines, etc.)
2. Draft posts about their immigration journey
3. Answer general immigration questions

Important guidelines:
- Be empathetic and supportive - immigration can be stressful
- Provide accurate information but always recommend consulting an immigration attorney for legal advice
- When users want to search, extract key details like visa type, consulate location, and outcome
- When users want to post, help them structure their experience with relevant details
- Keep responses concise and helpful

Available visa types: H-1B, F-1, B-1/B-2, L-1, O-1, EB-1, EB-2, EB-3, K-1, Green Card
`;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SearchIntent {
  type: 'search';
  visaType?: string;
  consulate?: string;
  outcome?: 'approved' | 'denied' | 'pending' | 'any';
  query: string;
}

export interface PostIntent {
  type: 'post';
  visaType?: string;
  consulate?: string;
  interviewDate?: string;
  outcome?: string;
  content: string;
}

export interface GeneralIntent {
  type: 'general';
  query: string;
}

export type Intent = SearchIntent | PostIntent | GeneralIntent;

function initializeGenAI() {
  if (!genAI && API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

export async function startChat(): Promise<void> {
  const ai = initializeGenAI();
  if (!ai) {
    throw new Error('Gemini API key not configured');
  }

  const model = ai.getGenerativeModel({ model: 'gemini-pro' });

  chatSession = model.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: 'You are Proceedings AI assistant. Follow these instructions: ' + SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'I understand. I\'m Proceedings AI, ready to help with US immigration questions, searching experiences, and drafting posts. How can I assist you today?' }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  });
}

export async function sendMessage(message: string): Promise<string> {
  if (!chatSession) {
    await startChat();
  }

  if (!chatSession) {
    return 'I\'m having trouble connecting. Please check your internet connection and try again.';
  }

  try {
    const result = await chatSession.sendMessage(message);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    return 'I encountered an error. Please try again.';
  }
}

export async function classifyIntent(message: string): Promise<Intent> {
  const lowerMessage = message.toLowerCase();

  // Simple keyword-based intent classification
  // In production, you could use Gemini for more sophisticated classification

  const searchKeywords = ['find', 'search', 'look for', 'show me', 'experiences', 'interviews'];
  const postKeywords = ['share', 'post', 'write', 'my experience', 'i want to tell', 'i had an interview'];

  const isSearch = searchKeywords.some(keyword => lowerMessage.includes(keyword));
  const isPost = postKeywords.some(keyword => lowerMessage.includes(keyword));

  // Extract visa type
  const visaTypes = ['h-1b', 'h1b', 'f-1', 'f1', 'b-1', 'b-2', 'b1', 'b2', 'l-1', 'l1', 'o-1', 'o1', 'eb-1', 'eb-2', 'eb-3', 'eb1', 'eb2', 'eb3', 'k-1', 'k1', 'green card'];
  let visaType: string | undefined;
  for (const visa of visaTypes) {
    if (lowerMessage.includes(visa)) {
      visaType = visa.toUpperCase().replace(/(\d)/, '-$1');
      break;
    }
  }

  // Extract consulate/location
  const consulates = ['mumbai', 'delhi', 'chennai', 'hyderabad', 'kolkata', 'london', 'toronto', 'vancouver', 'sydney', 'beijing', 'shanghai'];
  let consulate: string | undefined;
  for (const loc of consulates) {
    if (lowerMessage.includes(loc)) {
      consulate = loc.charAt(0).toUpperCase() + loc.slice(1);
      break;
    }
  }

  // Extract outcome
  let outcome: 'approved' | 'denied' | 'pending' | 'any' | undefined;
  if (lowerMessage.includes('approved') || lowerMessage.includes('approval')) {
    outcome = 'approved';
  } else if (lowerMessage.includes('denied') || lowerMessage.includes('denial') || lowerMessage.includes('rejected')) {
    outcome = 'denied';
  } else if (lowerMessage.includes('pending') || lowerMessage.includes('waiting')) {
    outcome = 'pending';
  }

  if (isSearch) {
    return {
      type: 'search',
      visaType,
      consulate,
      outcome: outcome || 'any',
      query: message,
    };
  } else if (isPost) {
    return {
      type: 'post',
      visaType,
      consulate,
      outcome,
      content: message,
    };
  } else {
    return {
      type: 'general',
      query: message,
    };
  }
}

export async function generatePostDraft(intent: PostIntent): Promise<string> {
  const prompt = `Based on this user's message about their immigration experience, help them create a structured post:

User's message: "${intent.content}"

Please generate a well-structured post that includes:
1. A clear title
2. Visa type and consulate (if mentioned)
3. Timeline and key dates
4. The experience details
5. Tips for others (if applicable)

Keep it concise and helpful for others going through the same process.`;

  return sendMessage(prompt);
}

export function isConfigured(): boolean {
  return !!API_KEY;
}
