"""
US Law practice area taxonomy for content classification.

Covers all major US law categories plus granular immigration sub-categories.
Each document can be assigned multiple labels (multi-label classification).
"""

CATEGORIES = [
    # =========================================================================
    # IMMIGRATION LAW — Granular Sub-Categories
    # =========================================================================
    {"id": "h1b-visa", "name": "H-1B Specialty Occupation", "description": "H-1B visa cap, lottery, registration, transfers, amendments, specialty occupation requirements, LCA, prevailing wage"},
    {"id": "family-based-immigration", "name": "Family-Based Immigration", "description": "Family preference categories, I-130 petitions, immediate relatives, marriage-based green cards, fiance visas (K-1)"},
    {"id": "asylum-refugees", "name": "Asylum & Refugees", "description": "Affirmative and defensive asylum, refugee processing, credible fear, withholding of removal, Convention Against Torture"},
    {"id": "naturalization-citizenship", "name": "Naturalization & Citizenship", "description": "N-400 application, civics test, oath ceremony, derivative citizenship, Certificate of Citizenship"},
    {"id": "daca", "name": "DACA", "description": "Deferred Action for Childhood Arrivals, initial applications, renewals, advance parole for DACA recipients"},
    {"id": "employment-green-cards", "name": "Employment-Based Green Cards", "description": "EB-1 extraordinary ability, EB-2 advanced degree, EB-3 skilled workers, PERM labor certification, National Interest Waiver"},
    {"id": "eb5-investor-visa", "name": "EB-5 Investor Visa", "description": "EB-5 direct investment, regional center program, Targeted Employment Areas, minimum investment amounts"},
    {"id": "student-visas", "name": "Student Visas (F-1/OPT/STEM OPT)", "description": "F-1 student visa, M-1 vocational, OPT, STEM OPT extension, CPT, SEVP, maintaining status"},
    {"id": "temporary-work-visas", "name": "Temporary Work Visas (L-1/O-1/TN/E)", "description": "L-1A/L-1B intracompany transfer, O-1 extraordinary ability, TN NAFTA, E-1/E-2 treaty, H-2A/H-2B seasonal"},
    {"id": "diversity-visa-lottery", "name": "Diversity Visa Lottery", "description": "DV lottery entry, selectee processing, qualifying countries, interview"},
    {"id": "deportation-defense", "name": "Deportation Defense", "description": "Removal proceedings, cancellation of removal, voluntary departure, prosecutorial discretion, bond hearings"},
    {"id": "humanitarian-parole", "name": "Humanitarian Parole", "description": "Parole-in-place, significant public benefit parole, urgent humanitarian reasons, CHNV programs"},
    {"id": "tps", "name": "Temporary Protected Status", "description": "TPS designation, re-registration, automatic extensions, EAD under TPS, designated countries"},
    {"id": "visa-fees-filing", "name": "Visa Fees & Filing", "description": "USCIS filing fees, fee waivers, premium processing, biometrics fees, fee schedule changes"},
    {"id": "consular-processing", "name": "Consular Processing", "description": "National Visa Center, DS-260, interview preparation, visa issuance, 221(g) administrative processing"},
    {"id": "adjustment-of-status", "name": "Adjustment of Status", "description": "I-485 application, concurrent filing, interview waiver, employment authorization while pending"},
    {"id": "travel-documents", "name": "Travel Documents", "description": "Advance parole, re-entry permits, refugee travel documents, emergency travel"},
    {"id": "work-authorization", "name": "Work Authorization", "description": "Employment Authorization Document (EAD), I-765, EAD categories, automatic extensions, combo card"},
    {"id": "immigration-court", "name": "Immigration Court", "description": "EOIR proceedings, BIA appeals, motions to reopen, motions to reconsider, administrative closure"},
    {"id": "general-immigration-info", "name": "General Immigration Info", "description": "Immigration overview content, glossaries, general resources, forms index, processing times"},

    # =========================================================================
    # BROAD US LAW CATEGORIES
    # =========================================================================
    {"id": "personal-injury", "name": "Personal Injury Law", "description": "Car accidents, slip and fall, wrongful death, product liability, premises liability, negligence claims, injury compensation"},
    {"id": "family-law", "name": "Family Law", "description": "Divorce, child custody, child support, alimony, adoption, prenuptial agreements, domestic violence, guardianship"},
    {"id": "criminal-law", "name": "Criminal Law", "description": "Criminal charges, felonies, misdemeanors, plea bargains, sentencing, criminal trials, white collar crime"},
    {"id": "criminal-defense", "name": "Criminal Defense Law", "description": "Defense strategies, Miranda rights, bail, public defenders, jury trials, appeals, expungement"},
    {"id": "business-law", "name": "Business Law", "description": "Business formation, contracts, partnerships, LLC, commercial disputes, mergers and acquisitions"},
    {"id": "corporate-law", "name": "Corporate Law", "description": "Corporate governance, shareholder rights, SEC compliance, board duties, corporate restructuring"},
    {"id": "bankruptcy-law", "name": "Bankruptcy Law", "description": "Chapter 7 liquidation, Chapter 11 reorganization, Chapter 13 repayment plans, creditor rights, debt discharge"},
    {"id": "real-estate-law", "name": "Real Estate Law", "description": "Property transactions, title disputes, zoning, landlord-tenant, foreclosure, commercial leases, HOA law"},
    {"id": "estate-planning", "name": "Estate Planning Law", "description": "Wills, trusts, power of attorney, living wills, estate administration, probate avoidance, asset protection"},
    {"id": "trusts-estates", "name": "Trusts & Estates Law", "description": "Probate proceedings, trust administration, estate litigation, inheritance disputes, fiduciary duties"},
    {"id": "intellectual-property", "name": "Intellectual Property Law", "description": "Patents, trademarks, copyrights, trade secrets, IP licensing, infringement litigation, DMCA"},
    {"id": "labor-employment", "name": "Labor & Employment Law", "description": "Wrongful termination, discrimination, harassment, wage disputes, FMLA, ADA, EEOC, union law, non-competes"},
    {"id": "tax-law", "name": "Tax Law", "description": "Income tax, corporate tax, tax planning, IRS audits, tax disputes, international tax, state and local tax"},
    {"id": "health-law", "name": "Health Law", "description": "Healthcare regulations, HIPAA, Medicare/Medicaid, medical licensing, health insurance disputes, FDA compliance"},
    {"id": "medical-malpractice", "name": "Medical Malpractice Law", "description": "Surgical errors, misdiagnosis, birth injuries, hospital negligence, informed consent, expert testimony"},
    {"id": "environmental-law", "name": "Environmental Law", "description": "EPA regulations, Clean Air Act, Clean Water Act, hazardous waste, environmental litigation, compliance"},
    {"id": "dui-law", "name": "DUI Law", "description": "Drunk driving charges, DUI/DWI defense, license suspension, breathalyzer tests, field sobriety tests, ignition interlock"},
    {"id": "elder-law", "name": "Elder Law", "description": "Medicaid planning, nursing home rights, elder abuse, conservatorship, Social Security, veterans benefits"},
    {"id": "education-law", "name": "Education Law", "description": "Student rights, special education (IEP/504), Title IX, school discipline, higher education law, teacher rights"},
    {"id": "entertainment-law", "name": "Entertainment Law", "description": "Entertainment contracts, talent agreements, music licensing, film rights, royalties, right of publicity"},
    {"id": "cybersecurity-law", "name": "Cybersecurity Law", "description": "Data breach response, privacy regulations, CCPA/GDPR, cybercrime, digital forensics, information security compliance"},
    {"id": "administrative-law", "name": "Administrative Law", "description": "Government agency regulations, administrative hearings, rulemaking, FOIA, regulatory compliance, licensing"},
    {"id": "commercial-law", "name": "Commercial Law", "description": "UCC, commercial transactions, sales law, secured transactions, letters of credit, commercial disputes"},
    {"id": "litigation", "name": "Litigation", "description": "Civil litigation, trial practice, discovery, depositions, settlement negotiations, appeals, class actions"},
    {"id": "international-law", "name": "International Law", "description": "International treaties, cross-border disputes, international trade, foreign investment, extradition, sanctions"},
    {"id": "traffic-law", "name": "Traffic Law", "description": "Traffic violations, speeding tickets, reckless driving, license points, traffic court, CDL violations"},
    {"id": "general-legal-info", "name": "General Legal Info", "description": "Legal overview content, legal glossaries, general resources, how to find a lawyer, legal aid"},
]

# Flat list of valid label IDs for validation
VALID_LABELS = [cat["id"] for cat in CATEGORIES]

# Old label → new label mapping for backward compatibility
OLD_TO_NEW_MAPPING = {
    "visa-info": "general-immigration-info",
    "eligibility": None,
    "process": None,
    "fees": "visa-fees-filing",
    "timeline": None,
    "other": "general-legal-info",
}


def build_category_descriptions() -> str:
    """Build a formatted string of all categories for use in prompts."""
    lines = []
    for cat in CATEGORIES:
        lines.append(f"- {cat['id']}: {cat['name']} — {cat['description']}")
    return "\n".join(lines)
