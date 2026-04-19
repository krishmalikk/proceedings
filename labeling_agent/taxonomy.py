"""
Immigration taxonomy for content classification.
Expanded from Imm Categories Excel — covers visa types, green card categories,
and process/status tags.

Each document can be assigned multiple labels (multi-label classification).
"""

CATEGORIES = [
    # =========================================================================
    # VISA CATEGORIES
    # =========================================================================
    {"id": "b1-b2-visitor", "name": "B-1/B-2 Visitor Visa", "description": "Business visitors (B-1) and tourism/medical visitors (B-2), ESTA, Visa Waiver Program"},
    {"id": "f1-student", "name": "F-1 Student Visa", "description": "Academic students at colleges/universities, OPT, STEM OPT, CPT, SEVP, DSO, maintaining status, I-20"},
    {"id": "j1-exchange", "name": "J-1 Exchange Visitor", "description": "Exchange programs, scholars, au pairs, interns, 2-year home residency requirement, J-1 waiver"},
    {"id": "h1b-visa", "name": "H-1B Specialty Occupation", "description": "H-1B cap, lottery, registration, transfers, amendments, specialty occupation, LCA, prevailing wage, 6-year rule"},
    {"id": "l1-transfer", "name": "L-1 Intracompany Transferee", "description": "L-1A managers/executives, L-1B specialized knowledge, intracompany transfer from foreign branch"},
    {"id": "o1-extraordinary", "name": "O-1 Extraordinary Ability", "description": "O-1A sciences/business/education, O-1B arts/entertainment, extraordinary achievement"},
    {"id": "e1-e2-treaty", "name": "E-1/E-2 Treaty Trader/Investor", "description": "Treaty trader (E-1), treaty investor (E-2), substantial trade or investment, treaty countries"},
    {"id": "tn-usmca", "name": "TN/TD USMCA Professional", "description": "TN visa for Canadian/Mexican professionals under USMCA (formerly NAFTA), TD dependents"},
    {"id": "k1-fiance", "name": "K-1 Fiance(e) Visa", "description": "Fiance/fiancee of US citizen, 90-day marriage requirement, K-2 children, adjustment after marriage"},
    {"id": "p-visa-athlete", "name": "P Visa (Athletes & Entertainers)", "description": "P-1 internationally recognized athletes/teams, P-2/P-3 artists and entertainers"},
    {"id": "r1-religious", "name": "R-1 Religious Worker", "description": "Ministers, religious vocations, non-profit religious organizations"},

    # =========================================================================
    # GREEN CARD CATEGORIES
    # =========================================================================
    {"id": "family-based-immigration", "name": "Family-Based Immigration", "description": "Immediate relatives (IR-1/2/5), family preference (F1-F4), I-130 petition, spouses/children/parents/siblings of US citizens and permanent residents"},
    {"id": "eb1-priority", "name": "EB-1 Priority Workers", "description": "EB-1A extraordinary ability, EB-1B outstanding professors/researchers, EB-1C multinational managers"},
    {"id": "eb2-niw", "name": "EB-2 Professionals / NIW", "description": "Advanced degree professionals, exceptional ability, National Interest Waiver, PERM labor certification"},
    {"id": "eb3-skilled", "name": "EB-3 Skilled Workers", "description": "Skilled workers (2+ years experience), professionals (bachelor's), other workers, PERM required"},
    {"id": "eb4-special", "name": "EB-4 Special Immigrants", "description": "Religious workers, Special Immigrant Juveniles (SIJ), former US government employees"},
    {"id": "eb5-investor-visa", "name": "EB-5 Immigrant Investor", "description": "EB-5 direct investment ($800K-$1.05M), regional center, Targeted Employment Areas, 10 job creation"},
    {"id": "diversity-visa-lottery", "name": "Diversity Visa Lottery", "description": "DV lottery, selectee processing, qualifying countries, annual 55,000 visa limit"},
    {"id": "special-immigrant-visa", "name": "Special Immigrant Visa (SIV)", "description": "Iraqi/Afghan translators, employees who worked for US government, combat interpreters"},

    # =========================================================================
    # PROCESS & STATUS CATEGORIES
    # =========================================================================
    {"id": "adjustment-of-status", "name": "Adjustment of Status", "description": "I-485 application, concurrent filing, interview waiver, AOS while in US"},
    {"id": "consular-processing", "name": "Consular Processing", "description": "NVC, DS-260, consular interview, visa issuance, 221(g) administrative processing, medical exam, visa stamping"},
    {"id": "visa-fees-filing", "name": "Visa Fees & Filing", "description": "USCIS filing fees, fee waivers, premium processing (I-907), biometrics fees"},
    {"id": "work-authorization", "name": "Work Authorization / EAD", "description": "Employment Authorization Document, I-765, EAD categories, automatic extensions, combo card, H4 EAD"},
    {"id": "deportation-defense", "name": "Deportation Defense", "description": "Removal proceedings, cancellation of removal, voluntary departure, bond hearings, NTA"},
    {"id": "asylum-refugees", "name": "Asylum & Refugees", "description": "Affirmative/defensive asylum, I-589, refugee processing, credible fear, withholding of removal, CAT"},
    {"id": "naturalization-citizenship", "name": "Naturalization & Citizenship", "description": "N-400, civics test, oath ceremony, derivative citizenship, dual citizenship"},
    {"id": "daca", "name": "DACA", "description": "Deferred Action for Childhood Arrivals, renewals, advance parole for DACA recipients, work permits"},
    {"id": "tps", "name": "Temporary Protected Status", "description": "TPS designation, re-registration, automatic extensions, EAD under TPS, designated countries"},
    {"id": "humanitarian-parole", "name": "Humanitarian Parole", "description": "Parole-in-place, significant public benefit parole, CHNV programs, urgent humanitarian reasons"},
    {"id": "immigration-court", "name": "Immigration Court / EOIR", "description": "EOIR proceedings, BIA appeals, motions to reopen/reconsider, administrative closure, in-absentia orders"},
    {"id": "travel-documents", "name": "Travel Documents", "description": "Advance parole, re-entry permits, refugee travel documents, automatic visa revalidation (AVR)"},

    # =========================================================================
    # H-1B SPECIFIC TAGS (high-volume Reddit topics)
    # =========================================================================
    {"id": "h1b-lottery", "name": "H-1B Lottery & Registration", "description": "H-1B cap registration, lottery selection, beneficiary selection rule, cap-gap extension"},
    {"id": "h1b-transfer", "name": "H-1B Transfer / Portability", "description": "H-1B employer transfer, portability rule, change of employer, receipt notice working"},
    {"id": "premium-processing", "name": "Premium Processing", "description": "I-907 premium processing, 15 business day adjudication, bundled premium processing"},
    {"id": "rfe-response", "name": "RFE / NOID Response", "description": "Request for Evidence, Notice of Intent to Deny, responding to USCIS requests, additional documentation"},
    {"id": "grace-period", "name": "Grace Period & Status Gap", "description": "60-day grace period, cap-gap extension, maintaining status between jobs, unlawful presence"},
    {"id": "change-of-status", "name": "Change of Status (COS)", "description": "F-1 to H-1B, L-1 to H-1B, B-1 to F-1, changing nonimmigrant status within US"},
    {"id": "layoff-immigration", "name": "Layoff & Immigration Impact", "description": "Job loss while on visa, employer obligations, bench policy, 60-day grace period, finding new sponsor"},

    # =========================================================================
    # CATCH-ALL
    # =========================================================================
    {"id": "general-immigration-info", "name": "General Immigration Info", "description": "Immigration overview, glossaries, general resources, forms index, processing times, case status, USCIS news"},
]

# Flat list of valid label IDs
VALID_LABELS = [cat["id"] for cat in CATEGORIES]

# All granular tags from the Excel (for secondary metadata, not primary classification)
GRANULAR_TAGS = [
    "visa-interview", "visa-scheduling", "consulate", "regular-processing",
    "cost", "OPT", "stem-opt", "cap-gap", "overstay", "NPT", "pardon",
    "h1b-extension", "f1-to-h1b", "tax-filing", "CBP", "physician",
    "re-entry", "h1b-wages", "country-ban", "passport", "ASC", "VAC",
    "SEVIS", "CPT", "visa-interview-slot", "visa-expired", "l1-to-h1b",
    "habeas", "CSPA", "NIW", "pp-clock", "NOID", "EAD", "cap-exempt",
    "LCA", "i797-no-physical-copy", "180-day-rule", "PERM", "PWD",
    "change-of-employer", "h1b-selection-rule", "NOIT", "stop-time-rule",
    "cancellation-of-removal", "in-absentia", "h1b-withdrawal",
    "h1b-portability-rule", "221g", "221g-pink", "221g-blue", "221g-yellow",
    "TAL", "PIMS", "pims-delay", "214b", "ESTA", "VWP", "AP",
    "240-day-extension", "visa-stamping", "AVR", "offer-rescind", "OFC",
    "travel-concern", "bundled-premium-processing", "FBAR",
    "lawyer-recommendation", "100k-fee", "prevailing-wage-compliance",
    "wage-level-weighting", "60-day-grace-period", "bench-policy",
    "speciality-occupation", "h1b-material-change", "fdns-visit",
    "h1b-6-year-rule", "stamping-delay", "h4-work-auth", "aging-out",
    "third-country", "i212-waiver", "prior-visa-rejection", "first-time-visa",
]


def build_category_descriptions() -> str:
    """Build a formatted string of all categories for use in prompts."""
    lines = []
    for cat in CATEGORIES:
        lines.append(f"- {cat['id']}: {cat['name']} — {cat['description']}")
    return "\n".join(lines)
