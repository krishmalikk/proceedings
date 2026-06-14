import {
  createEmptyProfile,
  toBackendProfile,
  fromBackendProfile,
  CONSULATE_OPTIONS,
  OnboardingProfile,
} from '../onboardingData';

describe('onboardingData mappers (mobile ↔ backend profile shape)', () => {
  it('createEmptyProfile returns an empty draft', () => {
    const p = createEmptyProfile();
    expect(p.currentStatus).toEqual([]);
    expect(p.consulates).toEqual([]);
    expect(p.keyStages).toEqual({});
    expect(p.backgroundText).toBe('');
  });

  it('toBackendProfile maps form fields to the backend payload (+ primary_consulate)', () => {
    const form: OnboardingProfile = {
      backgroundText: 'On H-1B from India',
      currentStatus: ['H-1B'],
      applyingFor: ['EB-3'],
      consulates: ['BOM', 'DEL'],
      tags: ['premium-processing'],
      keyStages: { 'I-140': 'filed' },
      keyDates: { priority_date: '2026-04-03' },
    };
    const b = toBackendProfile(form, [{ milestone: 'visa_interview', date: '', experience: 'x', shared: true }]);
    expect(b.current_visa_or_greencard_category).toEqual(['H-1B']);
    expect(b.visa_applying_for).toEqual(['EB-3']);
    expect(b.consulates).toEqual(['BOM', 'DEL']);
    expect(b.primary_consulate).toBe('BOM'); // first consulate
    expect(b.tags).toEqual(['premium-processing']);
    expect(b.key_stages_or_info).toEqual({ 'I-140': 'filed' });
    expect(b.key_dates).toEqual({ priority_date: '2026-04-03' });
    expect(b.background_text).toBe('On H-1B from India');
    expect(b.journey).toHaveLength(1);
  });

  it('fromBackendProfile maps the backend payload back to form fields', () => {
    const form = fromBackendProfile({
      current_visa_or_greencard_category: ['F-1'],
      visa_applying_for: ['H-1B'],
      consulates: ['BOM'],
      tags: ['OPT'],
      key_stages_or_info: { 'I-485': 'pending' },
      key_dates: { i140_filed_date: '2026-02-15' },
      background_text: 'student',
    });
    expect(form.currentStatus).toEqual(['F-1']);
    expect(form.applyingFor).toEqual(['H-1B']);
    expect(form.consulates).toEqual(['BOM']);
    expect(form.tags).toEqual(['OPT']);
    expect(form.keyStages).toEqual({ 'I-485': 'pending' });
    expect(form.keyDates).toEqual({ i140_filed_date: '2026-02-15' });
    expect(form.backgroundText).toBe('student');
  });

  it('round-trips form → backend → form without loss', () => {
    const form: OnboardingProfile = {
      backgroundText: 'b', currentStatus: ['H-1B'], applyingFor: ['EB-2'],
      consulates: ['DEL'], tags: ['NIW'], keyStages: { PERM: 'approved' }, keyDates: {},
    };
    expect(fromBackendProfile(toBackendProfile(form))).toEqual(form);
  });

  it('fromBackendProfile tolerates null/partial input', () => {
    expect(fromBackendProfile(null)).toEqual(createEmptyProfile());
    expect(fromBackendProfile({}).currentStatus).toEqual([]);
  });

  it('CONSULATE_OPTIONS use uppercase codes + display labels', () => {
    expect(CONSULATE_OPTIONS.length).toBeGreaterThan(0);
    for (const o of CONSULATE_OPTIONS) {
      expect(o.code).toMatch(/^[A-Z]{2,3}$/);
      expect(o.label.length).toBeGreaterThan(0);
    }
  });
});
