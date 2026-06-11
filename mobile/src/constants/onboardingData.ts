// Static data for onboarding - based on backend/tags-cleaned vocabulary

export const VISA_CATEGORIES = [
  'H-1B',
  'H-4',
  'F-1',
  'F-2',
  'L-1A',
  'L-1B',
  'L-2',
  'O-1',
  'J-1',
  'B-1/B-2',
  'EB-1',
  'EB-2',
  'EB-2-NIW',
  'EB-3',
  'EB-4',
  'EB-5',
  'Family-Based-GC',
  'CR-1',
  'IR-1',
  'K-1',
  'Diversity-Visa',
  'Asylum',
  'TPS',
  'DACA',
  'Green-Card',
  'Citizen',
];

export const CONSULATES = [
  'Mumbai, India',
  'Chennai, India',
  'New Delhi, India',
  'Hyderabad, India',
  'Kolkata, India',
  'Toronto, Canada',
  'Vancouver, Canada',
  'London, UK',
  'Manila, Philippines',
  'Mexico City, Mexico',
  'Ciudad Juarez, Mexico',
  'São Paulo, Brazil',
  'Sydney, Australia',
  'Seoul, South Korea',
  'Beijing, China',
  'Shanghai, China',
  'Guangzhou, China',
  'Tokyo, Japan',
  'Frankfurt, Germany',
  'Paris, France',
  'Lagos, Nigeria',
  'Accra, Ghana',
  'Other',
];

export const TAGS = [
  'PERM',
  'RFE',
  'RFE-Response',
  'NIW',
  'Premium-Processing',
  'Consular-Processing',
  'Adjustment-of-Status',
  'H-1B-Lottery',
  'H-1B-Cap',
  'H-1B-Transfer',
  'OPT',
  'STEM-OPT',
  'Cap-Gap',
  'EAD',
  'Advance-Parole',
  'Biometrics',
  '221g',
  'Administrative-Processing',
  'Port-of-Entry',
  'Travel',
  'Stamping',
  'Interview',
  'Denial',
  'Appeal',
  'USCIS',
  'NVC',
  'Priority-Date',
  'Retrogression',
];

export const KEY_STAGES = [
  { key: 'I-140', label: 'I-140' },
  { key: 'I-485', label: 'I-485' },
  { key: 'I-130', label: 'I-130' },
  { key: 'I-129', label: 'I-129' },
  { key: 'I-765', label: 'I-765 (EAD)' },
  { key: 'I-131', label: 'I-131 (AP)' },
  { key: 'DS-160', label: 'DS-160' },
  { key: 'DS-260', label: 'DS-260' },
  { key: 'PERM', label: 'PERM' },
];

export const STAGE_OUTCOMES = [
  'Not Started',
  'Filed',
  'Pending',
  'RFE Received',
  'RFE Responded',
  'Approved',
  'Denied',
  'Withdrawn',
];

export const KEY_DATE_TYPES = [
  { key: 'priority_date', label: 'Priority Date' },
  { key: 'i140_filed_date', label: 'I-140 Filed' },
  { key: 'i140_approved_date', label: 'I-140 Approved' },
  { key: 'i485_filed_date', label: 'I-485 Filed' },
  { key: 'perm_filed_date', label: 'PERM Filed' },
  { key: 'perm_approved_date', label: 'PERM Approved' },
  { key: 'visa_interview_date', label: 'Visa Interview' },
  { key: 'visa_stamping_date', label: 'Visa Stamping' },
  { key: 'arrival_date', label: 'US Arrival' },
  { key: 'ead_approved_date', label: 'EAD Approved' },
  { key: 'biometrics_date', label: 'Biometrics' },
];

export const MILESTONES = [
  { key: 'visa_interview', label: 'Visa Interview' },
  { key: 'visa_stamping', label: 'Visa Stamping' },
  { key: 'port_of_entry', label: 'Port of Entry' },
  { key: 'h1b_registration', label: 'H-1B Registration' },
  { key: 'h1b_lottery', label: 'H-1B Lottery' },
  { key: 'h1b_filing', label: 'H-1B Filing' },
  { key: 'h1b_approval', label: 'H-1B Approval' },
  { key: 'h1b_rfe', label: 'H-1B RFE' },
  { key: 'opt_application', label: 'OPT Application' },
  { key: 'stem_opt', label: 'STEM OPT' },
  { key: 'perm_filing', label: 'PERM Filing' },
  { key: 'perm_approval', label: 'PERM Approval' },
  { key: 'i140_filing', label: 'I-140 Filing' },
  { key: 'i140_approval', label: 'I-140 Approval' },
  { key: 'priority_date_current', label: 'Priority Date Current' },
  { key: 'i485_filing', label: 'I-485 Filing' },
  { key: 'biometrics', label: 'Biometrics' },
  { key: 'ead_approval', label: 'EAD Approval' },
  { key: 'advance_parole', label: 'Advance Parole' },
  { key: 'aos_interview', label: 'AOS Interview' },
  { key: 'green_card', label: 'Green Card Received' },
  { key: 'naturalization_interview', label: 'Naturalization Interview' },
  { key: 'oath_ceremony', label: 'Oath Ceremony' },
  { key: 'consular_221g', label: 'Consular 221(g)' },
  { key: 'nvc_processing', label: 'NVC Processing' },
  { key: 'other', label: 'Other Milestone' },
];

export interface OnboardingProfile {
  backgroundText: string;
  currentStatus: string[];
  applyingFor: string[];
  consulates: string[];
  tags: string[];
  keyStages: { [key: string]: string };
  keyDates: { [key: string]: string };
}

export interface JourneyEntry {
  milestone: string;
  date: string;
  experience: string;
  shared: boolean;
}

export const createEmptyProfile = (): OnboardingProfile => ({
  backgroundText: '',
  currentStatus: [],
  applyingFor: [],
  consulates: [],
  tags: [],
  keyStages: {},
  keyDates: {},
});
