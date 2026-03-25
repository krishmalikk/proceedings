# auto_label.py

**Stage:** 2 — Labeling (automated)
**Lines:** 165
**Location:** `/auto_label.py`

---

## Purpose

Automates the labeling step by using Gemini 2.5 Flash to classify crawled Markdown content, then submits annotations back to Label Studio via its API.

---

## How It Works

1. Fetches the first project from Label Studio
2. Gets all tasks (up to 100)
3. For each unlabeled task:
   - Downloads the actual Markdown content from GCS
   - Sends it to Gemini with a classification prompt
   - Parses the JSON array response into valid labels
   - Submits the annotation to Label Studio
4. Rate-limits at 15 seconds between requests (free tier: 5 req/min)

---

## Label Categories

| Label | Description |
|-------|-------------|
| `visa-info` | General information about visa types |
| `eligibility` | Who qualifies, requirements, conditions |
| `process` | Steps to apply, procedures, forms |
| `fees` | Costs, filing fees, payment methods |
| `timeline` | Processing times, wait periods, deadlines |
| `other` | Anything that doesn't fit above |

---

## Key Details

- Uses `gemini-2.5-flash` for classification (fast and cheap)
- Truncates content to 10,000 characters before sending to Gemini
- Skips already-annotated tasks
- Handles markdown code blocks in Gemini response
- After running, you must manually sync Target Storage in Label Studio to export to GCS

---

## Dependencies

- `google-genai` — Gemini API client
- `google-cloud-storage` — GCS content download
- `requests` — Label Studio API calls

---

## Env Vars Required

- `LABEL_STUDIO_URL`
- `LABEL_STUDIO_API_KEY`
- `GCP_BUCKET_NAME`
- `GOOGLE_API_KEY`
