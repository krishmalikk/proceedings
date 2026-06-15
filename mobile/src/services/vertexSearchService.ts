// Vertex AI Search Service for usajourney.ai
// This service handles semantic search over immigration experiences

export interface Experience {
  id: string;
  title: string;
  visaType: string;
  consulate?: string;
  interviewDate?: string;
  outcome: 'approved' | 'denied' | 'pending';
  summary: string;
  content: string;
  author: string;
  createdAt: Date;
  upvotes: number;
  comments: number;
}

export interface SearchResult {
  experiences: Experience[];
  totalCount: number;
  query: string;
}

// Mock data for development - replace with actual Vertex AI Search integration
const mockExperiences: Experience[] = [
  {
    id: '1',
    title: 'H-1B Interview Experience - Mumbai Consulate',
    visaType: 'H-1B',
    consulate: 'Mumbai',
    interviewDate: '2024-03-15',
    outcome: 'approved',
    summary: 'Smooth interview process, approved on the spot',
    content: 'I had my H-1B interview at the Mumbai consulate. The wait time was about 30 minutes. The officer asked about my job responsibilities and education background. Approved in 5 minutes!',
    author: 'anonymous_user_123',
    createdAt: new Date('2024-03-16'),
    upvotes: 45,
    comments: 12,
  },
  {
    id: '2',
    title: 'F-1 Visa Interview Tips - Delhi',
    visaType: 'F-1',
    consulate: 'Delhi',
    interviewDate: '2024-02-20',
    outcome: 'approved',
    summary: 'First attempt, approved with strong ties documentation',
    content: 'Brought extensive documentation showing ties to home country. Officer was friendly and asked about my study plans. Got the visa!',
    author: 'student_2024',
    createdAt: new Date('2024-02-22'),
    upvotes: 78,
    comments: 23,
  },
  {
    id: '3',
    title: 'H-1B Transfer Experience',
    visaType: 'H-1B',
    consulate: 'Chennai',
    interviewDate: '2024-01-10',
    outcome: 'approved',
    summary: 'H-1B transfer interview, quick approval',
    content: 'Transferred from Company A to Company B. Had all documents ready including new offer letter and approval notice. Interview lasted 3 minutes.',
    author: 'tech_worker_sf',
    createdAt: new Date('2024-01-12'),
    upvotes: 32,
    comments: 8,
  },
  {
    id: '4',
    title: 'B-2 Visa Denial - Mumbai',
    visaType: 'B-2',
    consulate: 'Mumbai',
    interviewDate: '2024-04-05',
    outcome: 'denied',
    summary: '214(b) denial, planning to reapply with stronger ties',
    content: 'Was denied under 214(b). The officer felt I didn\'t demonstrate strong enough ties. Planning to reapply with more documentation.',
    author: 'hopeful_traveler',
    createdAt: new Date('2024-04-06'),
    upvotes: 15,
    comments: 31,
  },
  {
    id: '5',
    title: 'Green Card Interview - Local Office',
    visaType: 'Green Card',
    interviewDate: '2024-03-28',
    outcome: 'approved',
    summary: 'Marriage-based green card approved after interview',
    content: 'Had our marriage-based green card interview. Officer asked about how we met, our daily routine, and looked at photos. Approved on the spot!',
    author: 'gc_applicant',
    createdAt: new Date('2024-03-29'),
    upvotes: 89,
    comments: 45,
  },
];

export interface SearchParams {
  query?: string;
  visaType?: string;
  consulate?: string;
  outcome?: 'approved' | 'denied' | 'pending' | 'any';
  limit?: number;
}

export async function searchExperiences(params: SearchParams): Promise<SearchResult> {
  // In production, this would call Vertex AI Search API
  // For now, using mock data with simple filtering

  let filtered = [...mockExperiences];

  if (params.visaType) {
    const normalizedVisa = params.visaType.toUpperCase().replace('-', '');
    filtered = filtered.filter(exp =>
      exp.visaType.toUpperCase().replace('-', '').includes(normalizedVisa)
    );
  }

  if (params.consulate) {
    filtered = filtered.filter(exp =>
      exp.consulate?.toLowerCase().includes(params.consulate!.toLowerCase())
    );
  }

  if (params.outcome && params.outcome !== 'any') {
    filtered = filtered.filter(exp => exp.outcome === params.outcome);
  }

  if (params.query) {
    const queryLower = params.query.toLowerCase();
    filtered = filtered.filter(exp =>
      exp.title.toLowerCase().includes(queryLower) ||
      exp.content.toLowerCase().includes(queryLower) ||
      exp.summary.toLowerCase().includes(queryLower)
    );
  }

  const limit = params.limit || 10;

  return {
    experiences: filtered.slice(0, limit),
    totalCount: filtered.length,
    query: params.query || '',
  };
}

export async function getExperienceById(id: string): Promise<Experience | null> {
  return mockExperiences.find(exp => exp.id === id) || null;
}

// Placeholder for actual Vertex AI Search integration
// TODO: Implement when GCP credentials are available
/*
export async function searchWithVertexAI(query: string): Promise<SearchResult> {
  const projectId = process.env.EXPO_PUBLIC_GCP_PROJECT_ID;
  const datastoreId = process.env.EXPO_PUBLIC_VERTEX_SEARCH_DATASTORE;

  const response = await fetch(
    `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/global/dataStores/${datastoreId}:search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        pageSize: 10,
      }),
    }
  );

  const data = await response.json();
  // Transform Vertex AI Search response to our Experience format
  return transformVertexResponse(data);
}
*/
