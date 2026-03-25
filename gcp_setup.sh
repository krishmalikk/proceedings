#!/bin/bash
# ===========================================
# GCP Bucket Setup for Proceedings RAG Pipeline
# ===========================================
# This script creates and configures the GCP Cloud Storage bucket
# that stores crawled Markdown files and labeled data.
#
# Prerequisites:
#   1. Install the gcloud CLI: https://cloud.google.com/sdk/docs/install
#   2. Authenticate: gcloud auth login
#   3. Set your project: gcloud config set project YOUR_PROJECT_ID
#      (or set the GCP_PROJECT_ID environment variable)
# ===========================================

set -euo pipefail

# Configuration
PROJECT_ID="proceedings-490601"
BUCKET_NAME="law-firm-knowledge-base"
REGION="us-central1"

echo "=== Step 1: Set active GCP project ==="
gcloud config set project "$PROJECT_ID"

echo ""
echo "=== Step 2: Create the Cloud Storage bucket ==="
echo "Creating gs://${BUCKET_NAME} in ${REGION}..."
gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access

echo ""
echo "=== Step 3: Block all public access ==="
gcloud storage buckets update "gs://${BUCKET_NAME}" \
    --public-access-prevention=enforced

echo ""
echo "=== Step 4: Enable versioning ==="
echo "This protects against accidental overwrites of crawled/labeled data."
gcloud storage buckets update "gs://${BUCKET_NAME}" \
    --versioning

echo ""
echo "=== Step 5: Create the labeled/ subfolder marker ==="
echo "Label Studio will export labeled data here."
echo "" | gcloud storage cp - "gs://${BUCKET_NAME}/labeled/.keep"

echo ""
echo "=== Step 6: Verify bucket configuration ==="
gcloud storage buckets describe "gs://${BUCKET_NAME}"

echo ""
echo "=== Done! ==="
echo "Bucket gs://${BUCKET_NAME} is ready."
echo "  - Location: ${REGION}"
echo "  - Public access: BLOCKED"
echo "  - Versioning: ENABLED"
echo "  - Labeled folder: gs://${BUCKET_NAME}/labeled/"
