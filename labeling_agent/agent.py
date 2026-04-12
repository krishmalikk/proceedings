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
    {"id": "general-immigration-info", "name": "General Immigration Info", "description": "Immigration overview content, glossaries, general resources, forms index, processing times, non-immigration legal content"},
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
