"""
monitor_qa.py — Monitor Q&A quality and identify knowledge gaps
================================================================
Reads Firestore qa_pairs collection and reports on fallback rate,
knowledge gaps, category distribution, and feedback.

USAGE:
  python monitor_qa.py
"""

import os
from collections import Counter

from dotenv import load_dotenv
from google.cloud import firestore

load_dotenv()


def main():
    project_id = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
    db = firestore.Client(project=project_id)

    print("=" * 60)
    print("Q&A QUALITY MONITOR")
    print("=" * 60)

    # Fetch all Q&A pairs
    docs = list(db.collection("qa_pairs").order_by("created_at", direction=firestore.Query.DESCENDING).stream())
    total = len(docs)

    if total == 0:
        print("\nNo Q&A pairs found in Firestore yet.")
        return

    fallbacks = []
    successful = []
    all_labels = []
    helpful_count = 0
    not_helpful_count = 0
    no_feedback = 0

    for doc in docs:
        data = doc.to_dict()
        if data.get("is_fallback"):
            fallbacks.append(data)
        else:
            successful.append(data)
            # Collect labels from retrieved chunks
            for chunk in data.get("retrieved_chunks", []):
                all_labels.extend(chunk.get("labels", []))

        feedback = data.get("helpful")
        if feedback is True:
            helpful_count += 1
        elif feedback is False:
            not_helpful_count += 1
        else:
            no_feedback += 1

    fallback_rate = len(fallbacks) / total if total > 0 else 0

    # Summary
    print(f"\n--- OVERVIEW ---")
    print(f"Total Q&A pairs: {total}")
    print(f"Successful answers: {len(successful)}")
    print(f"Fallback answers: {len(fallbacks)}")
    print(f"Fallback rate: {fallback_rate:.1%}")

    # Feedback
    print(f"\n--- FEEDBACK ---")
    print(f"Helpful: {helpful_count}")
    print(f"Not helpful: {not_helpful_count}")
    print(f"No feedback: {no_feedback}")

    # Knowledge gaps (fallback questions)
    if fallbacks:
        print(f"\n--- KNOWLEDGE GAPS (Top fallback questions) ---")
        for i, fb in enumerate(fallbacks[:15], 1):
            q = fb.get("question", "")[:80]
            sources = [c.get("source", "") for c in fb.get("retrieved_chunks", [])]
            print(f"  {i}. \"{q}\"")
            if sources:
                print(f"     Closest sources: {', '.join(sources[:3])}")

    # Category distribution
    if all_labels:
        label_counts = Counter(all_labels)
        print(f"\n--- CATEGORY DISTRIBUTION (in successful answers) ---")
        for label, count in label_counts.most_common(20):
            bar = "#" * min(count, 40)
            print(f"  {label:35s} {count:4d} {bar}")

    # Most asked topics
    print(f"\n--- RECENT QUESTIONS (last 10) ---")
    for i, doc_data in enumerate(docs[:10], 1):
        data = doc_data.to_dict() if hasattr(doc_data, 'to_dict') else doc_data
        q = data.get("question", "")[:70]
        status = "fallback" if data.get("is_fallback") else "answered"
        print(f"  {i}. [{status}] \"{q}\"")


if __name__ == "__main__":
    main()
