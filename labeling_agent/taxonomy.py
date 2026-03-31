"""
Immigration sub-category taxonomy for content classification.

20 categories covering the major areas of US immigration law.
Each document can be assigned multiple labels (multi-label classification).
"""

CATEGORIES = [
    {
        "id": "h1b-visa",
        "name": "H-1B Specialty Occupation",
        "description": "H-1B visa cap, lottery, registration, transfers, amendments, specialty occupation requirements, LCA, prevailing wage",
    },
    {
        "id": "family-based-immigration",
        "name": "Family-Based Immigration",
        "description": "Family preference categories, I-130 petitions, immediate relatives, marriage-based green cards, fiancé visas (K-1)",
    },
    {
        "id": "asylum-refugees",
        "name": "Asylum & Refugees",
        "description": "Affirmative and defensive asylum, refugee processing, credible fear, withholding of removal, Convention Against Torture",
    },
    {
        "id": "naturalization-citizenship",
        "name": "Naturalization & Citizenship",
        "description": "N-400 application, civics test, oath ceremony, derivative citizenship, Certificate of Citizenship",
    },
    {
        "id": "daca",
        "name": "DACA",
        "description": "Deferred Action for Childhood Arrivals, initial applications, renewals, advance parole for DACA recipients",
    },
    {
        "id": "employment-green-cards",
        "name": "Employment-Based Green Cards",
        "description": "EB-1 extraordinary ability, EB-2 advanced degree, EB-3 skilled workers, PERM labor certification, National Interest Waiver",
    },
    {
        "id": "eb5-investor-visa",
        "name": "EB-5 Investor Visa",
        "description": "EB-5 direct investment, regional center program, Targeted Employment Areas, minimum investment amounts",
    },
    {
        "id": "student-visas",
        "name": "Student Visas (F-1/OPT/STEM OPT)",
        "description": "F-1 student visa, M-1 vocational, OPT, STEM OPT extension, CPT, SEVP, maintaining status, transfers",
    },
    {
        "id": "temporary-work-visas",
        "name": "Temporary Work Visas (L-1/O-1/TN/E)",
        "description": "L-1A/L-1B intracompany transfer, O-1 extraordinary ability, TN NAFTA, E-1/E-2 treaty, H-2A/H-2B seasonal",
    },
    {
        "id": "diversity-visa-lottery",
        "name": "Diversity Visa Lottery",
        "description": "DV lottery entry, selectee processing, qualifying countries, photo requirements, interview",
    },
    {
        "id": "deportation-defense",
        "name": "Deportation Defense",
        "description": "Removal proceedings, cancellation of removal, voluntary departure, prosecutorial discretion, bond hearings",
    },
    {
        "id": "humanitarian-parole",
        "name": "Humanitarian Parole",
        "description": "Parole-in-place, significant public benefit parole, urgent humanitarian reasons, CHNV programs",
    },
    {
        "id": "tps",
        "name": "Temporary Protected Status",
        "description": "TPS designation, re-registration, automatic extensions, EAD under TPS, designated countries",
    },
    {
        "id": "visa-fees-filing",
        "name": "Visa Fees & Filing",
        "description": "USCIS filing fees, fee waivers, premium processing, biometrics fees, fee schedule changes",
    },
    {
        "id": "consular-processing",
        "name": "Consular Processing",
        "description": "National Visa Center, DS-260, interview preparation, visa issuance, 221(g) administrative processing, medical exam",
    },
    {
        "id": "adjustment-of-status",
        "name": "Adjustment of Status",
        "description": "I-485 application, concurrent filing, interview waiver, employment authorization while pending, travel while pending",
    },
    {
        "id": "travel-documents",
        "name": "Travel Documents",
        "description": "Advance parole, re-entry permits, refugee travel documents, emergency travel, maintaining status while traveling",
    },
    {
        "id": "work-authorization",
        "name": "Work Authorization",
        "description": "Employment Authorization Document (EAD), I-765, EAD categories, automatic extensions, combo card",
    },
    {
        "id": "immigration-court",
        "name": "Immigration Court",
        "description": "EOIR proceedings, BIA appeals, motions to reopen, motions to reconsider, administrative closure",
    },
    {
        "id": "general-immigration-info",
        "name": "General Immigration Info",
        "description": "Overview content, immigration glossaries, general resources, forms index, processing times, case status",
    },
]

# Flat list of valid label IDs for validation
VALID_LABELS = [cat["id"] for cat in CATEGORIES]

# Old label → new label mapping for backward compatibility
OLD_TO_NEW_MAPPING = {
    "visa-info": "general-immigration-info",
    "eligibility": None,  # Cross-cutting, not a primary category
    "process": None,       # Cross-cutting, not a primary category
    "fees": "visa-fees-filing",
    "timeline": None,      # Cross-cutting, not a primary category
    "other": "general-immigration-info",
}


def build_category_descriptions() -> str:
    """Build a formatted string of all categories for use in prompts."""
    lines = []
    for cat in CATEGORIES:
        lines.append(f"- {cat['id']}: {cat['name']} — {cat['description']}")
    return "\n".join(lines)
