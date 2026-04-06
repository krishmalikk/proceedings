# labeling_agent/

**Type:** Python package
**Location:** `/labeling_agent/`

---

## Purpose

Agent package for classifying immigration/legal content into 47 categories. Deployable to Vertex AI Agent Engine.

---

## Files

| File | Description |
|------|-------------|
| `__init__.py` | Package exports: `ImmigrationLabelingAgent`, `CATEGORIES`, `VALID_LABELS` |
| `taxonomy.py` | 47 category definitions with IDs, names, descriptions |
| `agent.py` | `ImmigrationLabelingAgent` class (Agent Engine contract: `__init__`, `set_up`, `query`) |
| `setup.py` | Package setup for Agent Engine deployment |

---

## Taxonomy: 47 Categories

**Immigration (20):** h1b-visa, family-based-immigration, asylum-refugees, naturalization-citizenship, daca, employment-green-cards, eb5-investor-visa, student-visas, temporary-work-visas, diversity-visa-lottery, deportation-defense, humanitarian-parole, tps, visa-fees-filing, consular-processing, adjustment-of-status, travel-documents, work-authorization, immigration-court, general-immigration-info

**Broad US Law (27):** personal-injury, family-law, criminal-law, criminal-defense, business-law, corporate-law, bankruptcy-law, real-estate-law, estate-planning, trusts-estates, intellectual-property, labor-employment, tax-law, health-law, medical-malpractice, environmental-law, dui-law, elder-law, education-law, entertainment-law, cybersecurity-law, administrative-law, commercial-law, litigation, international-law, traffic-law, general-legal-info

---

## Agent Class

```python
class ImmigrationLabelingAgent:
    def __init__(self, model, project, location)  # Config
    def set_up(self)                                # Init Gemini client
    def query(self, *, content, source_url) -> dict # Returns {"labels": [...], "confidence": 0.98}
```

- Uses `genai.Client(vertexai=True)` — paid GCP billing
- Retry logic for rate limits (3 attempts, exponential backoff)
- Validates labels against taxonomy
- Truncates content to 15,000 chars

---

## Deployment

Deployed via [[deploy_agent.py]] to Agent Engine.
Current resource: `projects/971592620882/locations/us-central1/reasoningEngines/7846942358309437440`

---

## Testing

15 test cases in `tests/test_labeling.py` — 100% accuracy.
