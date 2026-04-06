# agent_label.py

**Type:** Content labeling script via Agent Engine
**Location:** `/agent_label.py`

---

## Purpose

Labels crawled content using the deployed Vertex AI Agent Engine agent (or local agent). Classifies into 47 categories (20 immigration + 27 broad US law).

---

## How It Works

1. Loads crawled files from `crawled_pages/`
2. Checks which are already labeled in GCS `labeled/`
3. For each unlabeled file, calls the Agent Engine agent
4. Formats output as Label Studio-compatible JSON
5. Uploads to `gs://law-firm-knowledge-base/labeled/`

---

## Modes

| Flag | Mode | Description |
|------|------|-------------|
| (default) | Deployed | Calls Agent Engine remotely |
| `--local` | Local | Uses `ImmigrationLabelingAgent` locally (faster for batch) |

---

## Agent Engine

- **Resource:** `projects/971592620882/locations/us-central1/reasoningEngines/7846942358309437440`
- **Model:** Gemini 2.5 Flash via Vertex AI
- **Categories:** 47 (defined in [[labeling_agent/taxonomy.py]])
- **Test accuracy:** 15/15 (100%)

---

## Related

- Uses [[labeling_agent]] package for local mode
- Replaces `pipeline.py`'s old `classify_content()` function
- Output consumed by [[index.py]]
- Called by [[pipeline.py]] stage 2 and [[continuous_crawl.py]]
