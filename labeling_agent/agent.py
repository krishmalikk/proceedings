"""
Immigration content labeling agent for Vertex AI Agent Engine.

Follows the Agent Engine contract: __init__, set_up, query.
Can be used locally or deployed to Agent Engine via deploy_agent.py.

NOTE: The taxonomy is inlined here (not imported) so the agent is
self-contained when deployed to Agent Engine via cloudpickle.
"""

import json
import re
import time


# ---------------------------------------------------------------------------
# Inlined taxonomy (must match labeling_agent/taxonomy.py)
# ---------------------------------------------------------------------------

CATEGORIES = [
    # Visa categories
    {"id": "b1-b2-visitor", "name": "B-1/B-2 Visitor Visa", "description": "Business visitors (B-1) and tourism/medical visitors (B-2), ESTA, Visa Waiver Program"},
    {"id": "f1-student", "name": "F-1 Student Visa", "description": "Academic students, OPT, STEM OPT, CPT, SEVP, DSO, maintaining status, I-20"},
    {"id": "j1-exchange", "name": "J-1 Exchange Visitor", "description": "Exchange programs, scholars, au pairs, interns, 2-year home residency requirement, J-1 waiver"},
    {"id": "h1b-visa", "name": "H-1B Specialty Occupation", "description": "H-1B cap, lottery, registration, transfers, amendments, specialty occupation, LCA, prevailing wage, 6-year rule"},
    {"id": "l1-transfer", "name": "L-1 Intracompany Transferee", "description": "L-1A managers/executives, L-1B specialized knowledge, intracompany transfer"},
    {"id": "o1-extraordinary", "name": "O-1 Extraordinary Ability", "description": "O-1A sciences/business/education, O-1B arts/entertainment, extraordinary achievement"},
    {"id": "e1-e2-treaty", "name": "E-1/E-2 Treaty Trader/Investor", "description": "Treaty trader (E-1), treaty investor (E-2), substantial trade or investment"},
    {"id": "tn-usmca", "name": "TN/TD USMCA Professional", "description": "TN visa for Canadian/Mexican professionals under USMCA (formerly NAFTA)"},
    {"id": "k1-fiance", "name": "K-1 Fiance(e) Visa", "description": "Fiance/fiancee of US citizen, 90-day marriage requirement, K-2 children"},
    {"id": "p-visa-athlete", "name": "P Visa (Athletes & Entertainers)", "description": "P-1 internationally recognized athletes/teams, P-2/P-3 artists and entertainers"},
    {"id": "r1-religious", "name": "R-1 Religious Worker", "description": "Ministers, religious vocations, non-profit religious organizations"},
    # Green card categories
    {"id": "family-based-immigration", "name": "Family-Based Immigration", "description": "Immediate relatives (IR-1/2/5), family preference (F1-F4), I-130 petition"},
    {"id": "eb1-priority", "name": "EB-1 Priority Workers", "description": "EB-1A extraordinary ability, EB-1B professors/researchers, EB-1C multinational managers"},
    {"id": "eb2-niw", "name": "EB-2 Professionals / NIW", "description": "Advanced degree professionals, exceptional ability, National Interest Waiver, PERM"},
    {"id": "eb3-skilled", "name": "EB-3 Skilled Workers", "description": "Skilled workers (2+ years), professionals (bachelor's), other workers, PERM required"},
    {"id": "eb4-special", "name": "EB-4 Special Immigrants", "description": "Religious workers, Special Immigrant Juveniles (SIJ), former US government employees"},
    {"id": "eb5-investor-visa", "name": "EB-5 Immigrant Investor", "description": "EB-5 direct investment ($800K-$1.05M), regional center, TEA, 10 job creation"},
    {"id": "diversity-visa-lottery", "name": "Diversity Visa Lottery", "description": "DV lottery, selectee processing, qualifying countries, annual 55,000 limit"},
    {"id": "special-immigrant-visa", "name": "Special Immigrant Visa (SIV)", "description": "Iraqi/Afghan translators, employees who worked for US government"},
    # Process & status
    {"id": "adjustment-of-status", "name": "Adjustment of Status", "description": "I-485 application, concurrent filing, interview waiver, AOS while in US"},
    {"id": "consular-processing", "name": "Consular Processing", "description": "NVC, DS-260, consular interview, visa issuance, 221(g), medical exam, visa stamping"},
    {"id": "visa-fees-filing", "name": "Visa Fees & Filing", "description": "USCIS filing fees, fee waivers, premium processing (I-907), biometrics fees"},
    {"id": "work-authorization", "name": "Work Authorization / EAD", "description": "EAD, I-765, EAD categories, automatic extensions, combo card, H4 EAD"},
    {"id": "deportation-defense", "name": "Deportation Defense", "description": "Removal proceedings, cancellation of removal, voluntary departure, bond hearings, NTA"},
    {"id": "asylum-refugees", "name": "Asylum & Refugees", "description": "Affirmative/defensive asylum, I-589, refugee processing, credible fear, CAT"},
    {"id": "naturalization-citizenship", "name": "Naturalization & Citizenship", "description": "N-400, civics test, oath ceremony, derivative citizenship, dual citizenship"},
    {"id": "daca", "name": "DACA", "description": "Deferred Action for Childhood Arrivals, renewals, advance parole, work permits"},
    {"id": "tps", "name": "Temporary Protected Status", "description": "TPS designation, re-registration, automatic extensions, EAD under TPS"},
    {"id": "humanitarian-parole", "name": "Humanitarian Parole", "description": "Parole-in-place, significant public benefit parole, CHNV programs"},
    {"id": "immigration-court", "name": "Immigration Court / EOIR", "description": "EOIR proceedings, BIA appeals, motions to reopen/reconsider, in-absentia orders"},
    {"id": "travel-documents", "name": "Travel Documents", "description": "Advance parole, re-entry permits, refugee travel documents, AVR"},
    # H-1B specific (high-volume Reddit)
    {"id": "h1b-lottery", "name": "H-1B Lottery & Registration", "description": "H-1B cap registration, lottery selection, beneficiary selection rule, cap-gap extension"},
    {"id": "h1b-transfer", "name": "H-1B Transfer / Portability", "description": "H-1B employer transfer, portability rule, change of employer, receipt notice"},
    {"id": "premium-processing", "name": "Premium Processing", "description": "I-907, 15 business day adjudication, bundled premium processing"},
    {"id": "rfe-response", "name": "RFE / NOID Response", "description": "Request for Evidence, Notice of Intent to Deny, responding to USCIS requests"},
    {"id": "grace-period", "name": "Grace Period & Status Gap", "description": "60-day grace period, cap-gap extension, maintaining status, unlawful presence"},
    {"id": "change-of-status", "name": "Change of Status (COS)", "description": "F-1 to H-1B, L-1 to H-1B, B-1 to F-1, changing nonimmigrant status"},
    {"id": "layoff-immigration", "name": "Layoff & Immigration Impact", "description": "Job loss while on visa, employer obligations, bench policy, finding new sponsor"},
    # Catch-all
    {"id": "general-immigration-info", "name": "General Immigration Info", "description": "Immigration overview, glossaries, resources, forms index, processing times, USCIS news"},
]

VALID_LABELS = [cat["id"] for cat in CATEGORIES]


def _build_category_descriptions() -> str:
    lines = []
    for cat in CATEGORIES:
        lines.append(f"- {cat['id']}: {cat['name']} — {cat['description']}")
    return "\n".join(lines)


CLASSIFICATION_PROMPT = """You are an expert US immigration law content classifier.

Given markdown content from an immigration-related website, classify it into one or more of the following {num_categories} categories. A single document can belong to multiple categories.

CATEGORIES:
{category_descriptions}

RULES:
- Return ONLY a JSON object with two fields: "labels" (array of matching category IDs) and "confidence" (float 0.0-1.0 indicating your confidence in the classification)
- Choose ALL categories that apply — most documents will have 1-3 labels
- If the content doesn't clearly fit any specific category, use "general-immigration-info"
- Do NOT include categories that are only tangentially related
- Base your classification on the primary topic of the content, not passing mentions

EXAMPLE RESPONSE:
{{"labels": ["h1b-visa", "visa-fees-filing"], "confidence": 0.95}}

CONTENT:
{content}

CLASSIFICATION:"""


class ImmigrationLabelingAgent:
    """
    Agent that classifies immigration law content into sub-categories.

    Follows the Vertex AI Agent Engine contract:
    - __init__: Configuration parameters
    - set_up: One-time initialization (called on deploy/load)
    - query: Classification request handler
    """

    def __init__(self, model="gemini-2.5-flash", project=None, location=None):
        self.model = model
        self.project = project
        self.location = location
        self.client = None

    def set_up(self):
        """Initialize the Gemini client. Called once on deployment/load."""
        from google import genai
        self.client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
        )

    def query(self, *, content: str, source_url: str = "") -> dict:
        """
        Classify immigration content into sub-categories.

        Args:
            content: Markdown text content from a crawled page.
            source_url: Original URL (optional, for context).

        Returns:
            {"labels": ["h1b-visa", ...], "confidence": 0.92}
        """
        if self.client is None:
            self.set_up()

        clean_content = self._strip_frontmatter(content)
        truncated = clean_content[:15000]

        prompt = CLASSIFICATION_PROMPT.format(
            num_categories=len(CATEGORIES),
            category_descriptions=_build_category_descriptions(),
            content=truncated,
        )

        from google import genai as genai_module

        for attempt in range(3):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=genai_module.types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=2048,
                    ),
                )

                text = response.text
                if not text:
                    print("  Warning: Empty response, retrying...")
                    time.sleep(5)
                    continue

                return self._parse_response(text)

            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait = 10 * (attempt + 1)
                    print(f"  Rate limited, waiting {wait}s...")
                    time.sleep(wait)
                    continue
                print(f"  Classification error: {e}")
                return {"labels": ["general-immigration-info"], "confidence": 0.0}

        return {"labels": ["general-immigration-info"], "confidence": 0.0}

    def _parse_response(self, text: str) -> dict:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{[^}]+\}", text)
            if match:
                result = json.loads(match.group())
            else:
                return {"labels": ["general-immigration-info"], "confidence": 0.0}

        labels = result.get("labels", [])
        valid_labels = [l for l in labels if l in VALID_LABELS]
        if not valid_labels:
            valid_labels = ["general-immigration-info"]

        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        return {"labels": valid_labels, "confidence": confidence}

    @staticmethod
    def _strip_frontmatter(content: str) -> str:
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                return parts[2].strip()
        return content
