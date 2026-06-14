// API Service for Proceedings Mobile
// Connects to the same backend API as the website

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://immiguide-api-971592620882.us-central1.run.app';

// Active user management (stored in AsyncStorage)
let activeUserId: string | null = null;

export function getActiveUserId(): string | null {
  return activeUserId;
}

export async function loadActiveUser(): Promise<string | null> {
  try {
    activeUserId = await AsyncStorage.getItem('activeUserId');
    return activeUserId;
  } catch {
    return null;
  }
}

export async function setActiveUserId(id: string | null): Promise<void> {
  activeUserId = id;
  try {
    if (id) {
      await AsyncStorage.setItem('activeUserId', id);
    } else {
      await AsyncStorage.removeItem('activeUserId');
    }
  } catch {
    // Ignore storage errors
  }
}

function userHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (activeUserId) {
    headers['X-User-Id'] = activeUserId;
  }
  return headers;
}

/**
 * Register a Firebase uid with the backend (idempotent POST /api/users) so the
 * X-User-Id gate accepts it, then make it the active user for all API calls.
 */
export async function registerBackendUser(uid: string, username: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, username }),
    });
  } catch {
    // Best-effort — re-run on the next auth-state change; calls 404 until then.
  }
  await setActiveUserId(uid);
}

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

// ============= Users =============

export interface SeedUser {
  id: string;
  username: string;
  label?: string;
}

export async function getUsers(): Promise<SeedUser[]> {
  const response = await fetch(`${API_URL}/api/users`);
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// ============= Voting =============

export interface VoteResult {
  score: number;
  your_vote: number;
}

export async function castVote(contentId: string, dir: -1 | 0 | 1): Promise<VoteResult> {
  const response = await fetch(`${API_URL}/api/votes`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content_id: contentId, dir }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Vote failed');
  }
  return data;
}

// ============= Replies =============

export interface ReplyCardData {
  id: string;
  parent_case_id: string;
  body: string;
  author_handle: string;
  created_at: string;
  deleted: boolean;
  up: number;
  down: number;
  score: number;
  your_vote: number;
  is_author: boolean;
}

export interface RepliesResponse {
  replies: ReplyCardData[];
  posting?: { up: number; down: number; score: number; your_vote: number };
}

export async function getReplies(postingId: string, sort: 'top' | 'new' = 'new'): Promise<RepliesResponse> {
  const response = await fetch(
    `${API_URL}/api/postings/${encodeURIComponent(postingId)}/replies?sort=${sort}`,
    { headers: userHeaders() }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not load replies');
  }
  return data;
}

export async function postReply(postingId: string, body: string): Promise<ReplyCardData> {
  const response = await fetch(`${API_URL}/api/postings/${encodeURIComponent(postingId)}/replies`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ body }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not post reply');
  }
  return data;
}

export async function deleteReply(postingId: string, replyId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/postings/${encodeURIComponent(postingId)}/replies/${encodeURIComponent(replyId)}`,
    { method: 'DELETE', headers: userHeaders() }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Delete failed');
  }
}

// ============= Postings =============

// One labeled tag category on the detail view (mirrors the website right panel).
export interface TagSection {
  label: string;
  tags: string[];
}

export interface PostingData {
  case_id: string;
  title: string;
  description: string;
  visa: string[];
  consulates: string[];
  outcome: string;
  subreddit: string;
  channel: string;
  tags: string[];
  url: string;
  date: string;
  body: string; // full posting text (markdown on the website; rendered plain here)
  author_id: string; // authoring app user (empty for reddit/unknown)
  author_handle?: string; // first-party author handle (empty for external ingests)
  tag_sections?: TagSection[]; // every tag category kept separate (detail view)
}

// A posting author's structured profile (the PII-free profile shown in setup).
export interface PublicProfile {
  username: string;
  current_visa_or_greencard_category: string[];
  visa_applying_for: string[];
  primary_consulate: string;
  consulates: string[];
  tags: string[];
  key_stages_or_info: Record<string, string>;
  key_dates: Record<string, string>;
  background_text: string;
  journey: { milestone: string; date: string; experience: string; shared?: boolean }[];
}

export interface AuthorPostingCard {
  case_id: string;
  title: string;
  visa: string[];
  consulates: string[];
  outcome: string;
  date: string;
}

export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  try {
    const r = await fetch(`${API_URL}/api/users/${encodeURIComponent(uid)}/public-profile`);
    if (!r.ok) return null;
    return (await r.json()) as PublicProfile;
  } catch {
    return null;
  }
}

export async function getUserPostings(uid: string): Promise<AuthorPostingCard[]> {
  try {
    const r = await fetch(`${API_URL}/api/users/${encodeURIComponent(uid)}/postings`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.postings || []) as AuthorPostingCard[];
  } catch {
    return [];
  }
}

// All first-party postings authored under a given handle (newest first). Powers
// the author-by-handle screen (mirrors the website /author-by-handle/[handle]).
export async function getPostingsByHandle(handle: string): Promise<AuthorPostingCard[]> {
  try {
    const r = await fetch(`${API_URL}/api/authors/by-handle/${encodeURIComponent(handle)}/postings`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.postings || []) as AuthorPostingCard[];
  } catch {
    return [];
  }
}

export interface UserReplyCard {
  id: string;
  parent_case_id: string;
  body: string;
  created_at: string;
}

// All replies a user has authored (their 'activity'), newest first.
export async function getUserReplies(uid: string): Promise<UserReplyCard[]> {
  try {
    const r = await fetch(`${API_URL}/api/users/${encodeURIComponent(uid)}/replies`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.replies || []) as UserReplyCard[];
  } catch {
    return [];
  }
}

export interface PostingGroups {
  visa_applying_for: string[];
  current_visa_or_greencard_category: string[];
  primary_consulate: string;
  consulates: string[];
  tags: string[];
  concerns_or_questions_tags: string[];
}

export async function getPosting(caseId: string): Promise<PostingData> {
  const response = await fetch(`${API_URL}/api/postings/${encodeURIComponent(caseId)}`, {
    headers: userHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not load posting');
  }
  return data;
}

export async function createPosting(
  title: string,
  description: string,
  tags: PostingGroups,
  key_stages_or_info: Record<string, string>,
  key_dates: Record<string, string>
): Promise<{ case_id: string; author_handle: string }> {
  const response = await fetch(`${API_URL}/api/postings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, tags, key_stages_or_info, key_dates }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not publish posting');
  }
  return data;
}

export async function suggestTags(
  title: string,
  description: string
): Promise<{
  groups: PostingGroups;
  key_stages_or_info: Record<string, string>;
  key_dates: Record<string, string>;
  relevant_sections: string[];
  posting_type: string;
}> {
  const response = await fetch(`${API_URL}/api/tag-suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not analyze posting');
  }
  return data;
}

// ============= Tag Vocabulary =============

// ============= AI Onboarding (same contract as the website's /api/onboard) ====

export interface OnboardJourneyEntry {
  milestone: string;
  date: string;
  experience: string;
  shared?: boolean;
  experience_case_id?: string;
}

// The backend ProfilePayload shape used as the onboarding draft.
export interface OnboardProfile {
  username?: string;
  current_visa_or_greencard_category: string[];
  visa_applying_for: string[];
  primary_consulate: string;
  consulates: string[];
  tags: string[];
  key_stages_or_info: Record<string, string>;
  key_dates: Record<string, string>;
  background_text: string;
  journey?: OnboardJourneyEntry[];
}

export interface OnboardResponse {
  reply: string;
  profile: OnboardProfile;
  done: boolean;
}

/** One conversational AI-onboarding turn (stage 1 'basics' | stage 2 'experiences'). */
export async function onboardTurn(
  stage: 'basics' | 'experiences',
  messages: { role: string; content: string }[],
  draft: OnboardProfile
): Promise<OnboardResponse> {
  const response = await fetch(`${API_URL}/api/onboard`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ stage, messages, draft }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Onboarding assistant error');
  }
  return data;
}

// ============= Search (same contract as the website's /api/search) =============

export type Strictness = 'broad' | 'balanced' | 'strict';

export interface SearchResultItem {
  case_id: string;
  title: string;
  description: string;
  visa: string[];
  consulates: string[];
  outcome: string;
  subreddit: string;
  channel: string;
  tags: string[];
  url: string;
  date: string;
}

export interface SearchFacetValue {
  code: string;
  label: string;
  count: number;
}

export interface SuggestedFilterGroup {
  key: string;
  label: string;
  field: string;
  values: SearchFacetValue[];
}

export interface SearchResponse {
  results: SearchResultItem[];
  next_page_token: string;
  suggested_filters: SuggestedFilterGroup[];
}

// Selection id used for the backend `facet` param — mirrors the website's facetId().
export const facetId = (field: string, code: string) => `${field}:${code}`;

export async function searchPostings(
  q: string,
  opts: { strictness?: Strictness; facets?: string[]; pageToken?: string; pageSize?: number } = {}
): Promise<SearchResponse> {
  const p = new URLSearchParams();
  p.set('q', q || 'immigration visa experience');
  (opts.facets || []).forEach((f) => p.append('facet', f));
  p.set('strictness', opts.strictness || 'balanced');
  p.set('page_size', String(opts.pageSize ?? 15));
  if (opts.pageToken) p.set('page_token', opts.pageToken);
  const response = await fetch(`${API_URL}/api/search?${p.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Search failed');
  }
  return {
    results: data.results || [],
    next_page_token: data.next_page_token || '',
    suggested_filters: data.suggested_filters || [],
  };
}

export interface ConsulateCountry {
  country: string;
  country_code: string;
  cities: { code: string; city: string }[];
}

export interface TagVocab {
  visa: string[];
  consulate: string[];
  consulate_options: { code: string; label: string }[];
  consulate_tree: ConsulateCountry[];
  tag: string[];
  misc: string[];
  misc_options: { code: string; label: string }[];
  stage_key: string[];
  date_key: string[];
  profile_stage_key: string[];
  stage_value_domains: Record<string, string>;
  country: string[];
  outcome: string[];
}

// Cached per app session; returns null offline so callers can fall back to the
// curated constants in constants/onboardingData.
let vocabCache: TagVocab | null = null;

export async function getTagVocab(): Promise<TagVocab | null> {
  if (vocabCache) return vocabCache;
  try {
    const response = await fetch(`${API_URL}/api/tag-vocab`);
    if (!response.ok) return null;
    const data = await response.json();
    vocabCache = {
      visa: data.visa || [],
      consulate: data.consulate || [],
      consulate_options: data.consulate_options || [],
      consulate_tree: data.consulate_tree || [],
      tag: data.tag || [],
      misc: data.misc || [],
      misc_options: data.misc_options || [],
      stage_key: data.stage_key || [],
      date_key: data.date_key || [],
      profile_stage_key: data.profile_stage_key || [],
      stage_value_domains: data.stage_value_domains || {},
      country: data.country || [],
      outcome: data.outcome || [],
    };
    return vocabCache;
  } catch {
    return null;
  }
}

// ============= Matching / Find =============

export interface MatchData {
  user_id: string;
  username: string;
  score: number;
  shared: string[];
  summary: string;
  background?: string;
}

export interface Criteria {
  current_visa_or_greencard_category: string[];
  visa_applying_for: string[];
  primary_consulate: string;
  consulates: string[];
  key_stages_or_info: Record<string, string>;
  key_dates: Record<string, string>;
  background_text: string;
}

export async function findChat(
  messages: { role: string; content: string }[],
  draft: Criteria
): Promise<{ reply: string; criteria: Criteria }> {
  const response = await fetch(`${API_URL}/api/find/chat`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ messages, draft }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Find chat error');
  }
  return data;
}

export async function findMatches(criteria: Criteria): Promise<{ matches: MatchData[] }> {
  const response = await fetch(`${API_URL}/api/find/matches`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ criteria }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not find matches');
  }
  return data;
}

// ============= Groups =============

export interface GroupMember {
  user_id: string;
  username: string;
}

export interface GroupInfo {
  group_id: string;
  name: string;
  criteria_text: string;
  members: GroupMember[];
  is_member: boolean;
}

export interface GroupResult {
  group_id: string;
  name: string;
  joined: boolean;
  members: GroupMember[];
}

export async function getGroup(groupId: string): Promise<GroupInfo> {
  const response = await fetch(`${API_URL}/api/groups/${encodeURIComponent(groupId)}`, {
    headers: userHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not load group');
  }
  return data;
}

export async function getAllGroups(): Promise<{ groups: GroupInfo[] }> {
  const response = await fetch(`${API_URL}/api/groups/all`, {
    headers: userHeaders(),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not load groups');
  }
  return data;
}

export async function createGroup(
  criteriaText: string,
  criteria: Criteria,
  members: GroupMember[]
): Promise<GroupResult> {
  const response = await fetch(`${API_URL}/api/groups`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ criteria_text: criteriaText, criteria, members }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not create group');
  }
  return data;
}

export async function joinGroup(groupId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/groups/${encodeURIComponent(groupId)}/join`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Could not join group');
  }
}

// ============= Group Chat =============

export interface ChatMessage {
  id: string;
  author_handle: string;
  text: string;
  created_at: string;
  deleted: boolean;
  is_author: boolean;
}

export async function getGroupMessages(
  groupId: string,
  since?: string
): Promise<{ messages: ChatMessage[]; denied?: boolean }> {
  const url = since
    ? `${API_URL}/api/groups/${encodeURIComponent(groupId)}/messages?since=${encodeURIComponent(since)}`
    : `${API_URL}/api/groups/${encodeURIComponent(groupId)}/messages`;
  const response = await fetch(url, { headers: userHeaders() });
  if (response.status === 403) {
    return { messages: [], denied: true };
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not load messages');
  }
  return { messages: data.messages || [] };
}

export async function sendGroupMessage(groupId: string, text: string): Promise<ChatMessage> {
  const response = await fetch(`${API_URL}/api/groups/${encodeURIComponent(groupId)}/messages`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Could not send message');
  }
  return data;
}

export async function deleteGroupMessage(groupId: string, messageId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/groups/${encodeURIComponent(groupId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE', headers: userHeaders() }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Delete failed');
  }
}

// ============= Profile / Reconcile =============

export interface ReconcileResult {
  conflicts: { field: string; profile_value: unknown; message_value: unknown }[];
  explainer: string;
  merged: Criteria;
  prefilled: string[];
}

export async function reconcile(message: Partial<Criteria>): Promise<ReconcileResult> {
  const response = await fetch(`${API_URL}/api/reconcile`, {
    method: 'POST',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Reconcile failed');
  }
  return data;
}

// Profile cache key
const PROFILE_CACHE_KEY = 'proceedings_profile_cache';

// Get cached profile (returns null if not cached)
export async function getCachedProfile(): Promise<Record<string, unknown> | null> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

// Save profile to cache
async function cacheProfile(profile: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore cache errors
  }
}

// Clear profile cache (call on sign out)
export async function clearProfileCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Ignore cache errors
  }
}

export async function getProfile(): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_URL}/api/profile`, {
    headers: userHeaders(),
  });
  const data = await response.json();
  // Cache the fresh profile
  await cacheProfile(data);
  return data;
}

export async function updateProfile(profile: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${API_URL}/api/profile`, {
    method: 'PUT',
    headers: userHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Could not update profile');
  }
}
