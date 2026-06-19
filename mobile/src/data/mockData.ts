// Mock data for Meridian screens

export const pathwayOptions = [
  { label: 'Employment-Based (H-1B, L-1, etc.)', value: 'employment' },
  { label: 'Family-Based (Spouse, Parent, etc.)', value: 'family' },
  { label: 'Student Visa (F-1, OPT, etc.)', value: 'student' },
  { label: 'Investor/Business (EB-5, E-2)', value: 'investor' },
  { label: 'Asylum/Refugee', value: 'asylum' },
  { label: 'Citizenship/Naturalization', value: 'citizenship' },
];

export const stageOptions = [
  { label: 'Just starting research', value: 'research' },
  { label: 'Preparing documents', value: 'preparing' },
  { label: 'Application submitted', value: 'submitted' },
  { label: 'Waiting for decision', value: 'waiting' },
  { label: 'Received RFE/NOID', value: 'rfe' },
  { label: 'Interview scheduled', value: 'interview' },
  { label: 'Case approved', value: 'approved' },
  { label: 'Case denied - appealing', value: 'appealing' },
];

export const visaFilters = [
  { label: 'All Threads', value: 'all' },
  { label: 'H-1B Visa', value: 'h1b' },
  { label: 'F-1 Student', value: 'f1' },
  { label: 'Green Card', value: 'gc' },
  { label: 'Citizenship', value: 'citizenship' },
];

export const forumThreads = [
  {
    id: '1',
    tags: ['H-1B', 'Form I-129', 'Pre-filing'],
    title: 'RFC received for Specialty Occupation: How to handle?',
    excerpt:
      'I just received an RFE for my H-1B transfer. They\'re questioning the specialty occupation requirement. Has anyone dealt with this before?',
    timeAgo: '2h ago',
    views: 24,
    comments: 12,
    helpfulCount: 8,
  },
  {
    id: '2',
    tags: ['F-1', 'OPT', 'Job Search'],
    title: 'Timeline for Post-Completion OPT in 2024?',
    excerpt:
      'Applying for OPT next month. Does anyone have recent data on how long processing is taking? I\'ve heard mixed things about current wait times.',
    timeAgo: '5h ago',
    views: 18,
    comments: 45,
    helpfulCount: 15,
  },
  {
    id: '3',
    tags: ['Green Card', 'Marriage-based', 'Interview'],
    title: 'My Interview Experience at NYC Field Office',
    excerpt:
      'Sharing our story to give hope to others! The officer was polite, asked mostly about our relationship timeline and evidence...',
    timeAgo: '1d ago',
    views: 112,
    comments: 56,
    helpfulCount: 42,
  },
];

export const expertSpotlight = {
  title: 'Ask an Attorney Anything',
  description:
    'Our verified legal partners are answering questions about the 2024 H-1B Lottery changes live this Thursday.',
  buttonText: 'Set Reminder',
};

export const attorneys = [
  {
    id: '1',
    name: 'Marcus Thorne, Esq.',
    title: 'Senior Immigration Attorney',
    firm: 'Thorne & Associates Immigration',
    imageUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    barAdmission: 'NY BAR ADMITTED',
    specialties: ['Business Immigration', 'Investment Visas'],
    languages: ['English', 'Spanish'],
    responseRate: '98%',
    responseTime: '< 2 hrs',
  },
  {
    id: '2',
    name: 'Elena Rodriguez',
    title: 'Immigration Consultant',
    firm: 'Global Path Consultants',
    imageUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    barAdmission: 'CA BAR ADMITTED',
    specialties: ['Family Reunification', 'DACA'],
    languages: ['English', 'Portuguese'],
    responseRate: '92%',
    responseTime: '< 4 hrs',
  },
];

export const specialtyFilters = [
  { label: 'Family-Based', value: 'family' },
  { label: 'H1-B & Work', value: 'h1b' },
  { label: 'Asylum/Refugee', value: 'asylum' },
  { label: 'Green Card', value: 'greencard' },
  { label: 'Citizenship', value: 'citizenship' },
];

export const caseMatches = [
  {
    id: '1',
    matchPercentage: 98,
    isVerified: true,
    isResolved: false,
    title: 'RFE for Specialty Occupation: Software Engineer in Web3 Startup',
    tags: ['I-129', 'H-1B', 'RFE'],
    similarCases: 142,
    timeAgo: 'Updated 2d ago',
  },
  {
    id: '2',
    matchPercentage: 85,
    isVerified: false,
    isResolved: true,
    title: 'Complex RFE Response for Product Manager: Education vs Experience',
    tags: ['I-140', 'EB-2', 'PERM'],
    similarCases: 89,
    timeAgo: 'Updated 1w ago',
  },
  {
    id: '3',
    matchPercentage: 72,
    isVerified: true,
    isResolved: true,
    title: 'Managerial Duties for L-1A Multinational Executive',
    tags: ['L-1A', 'Multinational'],
    similarCases: 12,
    timeAgo: 'Updated 3d ago',
  },
];

export const applicationStages = [
  { label: 'RFE Response', value: 'rfe' },
  { label: 'Initial Filing', value: 'initial' },
  { label: 'Interview', value: 'interview' },
];

export const newsArticles = [
  {
    id: '1',
    source: 'USCIS',
    date: 'Oct 14, 2023',
    title: 'New Premium Processing Timeline for EB-2 NIW',
    excerpt:
      'USCIS announces reduction in processing times for National Interest Waiver cases starting next fiscal quarter...',
    relevanceTag: 'Relevant to your EB-2 NIW interest',
  },
  {
    id: '2',
    source: 'DOL News',
    date: 'Oct 12, 2023',
    title: 'Update on Prevailing Wage Determination Delays',
    excerpt:
      'Department of Labor reports a 15% increase in efficiency for PERM processing after technical upgrades...',
    relevanceTag: 'Relevant to your H-1B extension',
  },
  {
    id: '3',
    source: 'White House',
    date: 'Oct 21, 2023',
    title: 'Executive Order signed to streamline STEM immigration',
    excerpt:
      'New directive focuses on retaining advanced degree graduates from US universities...',
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400',
    relevanceTag: 'Monitored for potential EB-2 category impact',
  },
];

export const caseDetail = {
  id: '1',
  status: 'RESOLVED',
  category: 'I-485 RFE Response',
  title: 'Resolution: Misplaced Birth Certificate Evidence',
  description:
    'Detailed resolution for the Request for Evidence (RFE) regarding secondary birth records in EB-2 adjustment cases.',
  verifiedBy: 'Sarah Chen',
  verifiedTitle: 'Senior Immigration Attorney',
  verifiedExperience: '12 years experience',
  whatWorked: {
    summary:
      'The key to resolving the RFE was not just resubmitting the original document, but providing Secondary Evidence alongside a Non-Availability Certificate from the issuing municipality. USCIS accepts this combination when primary records are destroyed or unavailable.',
    checklist: [
      { text: 'Non-Availability Certificate (Official)', checked: true },
      { text: 'Affidavits from two close relatives', checked: true },
      { text: 'Early school records (pre-10 years old)', checked: true },
      { text: 'Translated baptismal certificate', checked: true },
    ],
  },
  timeline: [
    {
      step: 1,
      title: 'Obtain Official Refusal',
      description:
        'Acquire the "Certificate of Non-Availability" from the competent local authority where you were born. Ensure it mentions the specific time period searched.',
    },
    {
      step: 2,
      title: 'Collect Sworn Affidavits',
      description:
        'Draft two affidavits from parents or older relatives. These must explicitly state the facts of birth and why the witness has personal knowledge.',
    },
    {
      step: 3,
      title: 'Response Submission',
      description:
        'Package all secondary evidence with a cover letter referencing "8 CFR 103.2(b)(2)(i)" which clarifies the hierarchy of evidence for USCIS.',
    },
  ],
  officialSources: [
    { title: 'USCIS Policy Manual: Evidence of Birth', icon: 'document' },
    { title: 'Department of State Reciprocity Table', icon: 'globe' },
  ],
  stats: {
    views: 142,
    upvotes: 24,
    comments: 8,
  },
};
