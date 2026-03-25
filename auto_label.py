"""
auto_label.py — Automated Labeling via Gemini + Label Studio API
=================================================================
Fetches tasks from Label Studio, downloads the actual markdown content
from GCS, classifies it using Gemini, and submits annotations back
via the Label Studio API.

Usage:
  python auto_label.py
"""

import os
import json
import time
import requests
from dotenv import load_dotenv
from google.cloud import storage as gcs
from google import genai

load_dotenv()

# --- Config ---
LABEL_STUDIO_URL = os.getenv("LABEL_STUDIO_URL", "http://localhost:8080").rstrip("/")
LABEL_STUDIO_API_KEY = os.getenv("LABEL_STUDIO_API_KEY")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")
GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")

VALID_LABELS = ["visa-info", "eligibility", "process", "fees", "timeline", "other"]

CLASSIFICATION_PROMPT = """You are a legal content classifier. Given the following markdown content from an immigration law website, classify it into one or more of these categories:

- visa-info: General information about visa types, categories, descriptions
- eligibility: Who qualifies, requirements, conditions
- process: Steps to apply, procedures, forms needed
- fees: Costs, filing fees, payment methods
- timeline: Processing times, wait periods, deadlines
- other: Anything that doesn't fit the above categories

Respond with ONLY a JSON array of matching category strings. For example: ["visa-info", "process"]

Content:
{content}
"""

# --- Label Studio API helpers ---
headers = {
    "Authorization": f"Token {LABEL_STUDIO_API_KEY}",
    "Content-Type": "application/json",
}


def get_project_id():
    resp = requests.get(f"{LABEL_STUDIO_URL}/api/projects", headers=headers)
    resp.raise_for_status()
    projects = resp.json().get("results", [])
    if not projects:
        raise RuntimeError("No projects found in Label Studio")
    return projects[0]["id"]


def get_tasks(project_id):
    resp = requests.get(
        f"{LABEL_STUDIO_URL}/api/tasks",
        headers=headers,
        params={"project": project_id, "page_size": 100},
    )
    resp.raise_for_status()
    return resp.json().get("tasks", [])


def delete_annotations(task_id):
    """Delete all existing annotations for a task."""
    resp = requests.get(
        f"{LABEL_STUDIO_URL}/api/tasks/{task_id}/annotations/",
        headers=headers,
    )
    resp.raise_for_status()
    for ann in resp.json():
        requests.delete(
            f"{LABEL_STUDIO_URL}/api/annotations/{ann['id']}/",
            headers=headers,
        )


def submit_annotation(task_id, labels):
    result = [{"from_name": "category", "to_name": "text", "type": "choices", "value": {"choices": labels}}]
    payload = {"result": result}
    resp = requests.post(
        f"{LABEL_STUDIO_URL}/api/tasks/{task_id}/annotations/",
        headers=headers,
        json=payload,
    )
    resp.raise_for_status()
    return resp.json()


def classify_content(client, content):
    """Use Gemini to classify markdown content into label categories."""
    prompt = CLASSIFICATION_PROMPT.format(content=content[:10000])
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    text = response.text.strip()

    # Handle markdown code blocks in response
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    labels = json.loads(text)
    labels = [l for l in labels if l in VALID_LABELS]
    return labels if labels else ["other"]


def main():
    print("Initializing Gemini...")
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    # Init GCS client
    gcs_client = gcs.Client()
    bucket = gcs_client.bucket(GCP_BUCKET_NAME)

    print("Fetching project from Label Studio...")
    project_id = get_project_id()
    print(f"  Project ID: {project_id}")

    print("Fetching tasks...")
    tasks = get_tasks(project_id)
    print(f"  Found {len(tasks)} tasks")

    labeled = 0
    for i, task in enumerate(tasks):
        filename = task.get("storage_filename", "")
        if not filename:
            print(f"  Task {task['id']}: no storage_filename, skipping")
            continue

        # Skip already-annotated tasks
        if task.get("total_annotations", 0) > 0:
            print(f"  Task {task['id']} ({filename}): already labeled, skipping")
            continue

        # Download actual content from GCS
        print(f"  Task {task['id']} ({filename}): downloading...", end=" ")
        blob = bucket.blob(filename)
        content = blob.download_as_text()

        labels = classify_content(client, content)
        print(f"→ {labels}")

        submit_annotation(task["id"], labels)
        labeled += 1

        # Rate limit: free tier allows 5 requests/min
        if i < len(tasks) - 1:
            time.sleep(15)

    print(f"\nDone! Labeled {labeled} tasks.")
    print("Now go to Label Studio → Cloud Storage → Target Storage → Sync Storage")
    print("to export the annotations to GCS.")


if __name__ == "__main__":
    main()
