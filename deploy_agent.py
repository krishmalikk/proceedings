"""
deploy_agent.py — Deploy the Immigration Labeling Agent to Vertex AI Agent Engine
==================================================================================
One-time script to deploy the ImmigrationLabelingAgent to Agent Engine.
After deployment, the agent can be called remotely via its resource name.

USAGE:
  python deploy_agent.py

AFTER RUNNING:
  Copy the AGENT_ENGINE_RESOURCE_NAME into your .env file.
"""

import os

import vertexai
from dotenv import load_dotenv

from labeling_agent.agent import ImmigrationLabelingAgent

load_dotenv()


def main():
    project_id = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
    region = os.getenv("GCP_REGION", "us-central1")

    print("=" * 50)
    print("Deploying Immigration Labeling Agent to Agent Engine")
    print("=" * 50)

    # Initialize Vertex AI
    client = vertexai.Client(project=project_id, location=region)

    # Create the agent
    agent = ImmigrationLabelingAgent(
        model="gemini-2.5-flash",
        project=project_id,
        location=region,
    )

    print("Creating Agent Engine instance...")
    print("  (This may take a few minutes)")

    bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")

    remote_agent = client.agent_engines.create(
        agent=agent,
        config={
            "displayName": "immigration-labeling-agent",
            "description": "Classifies immigration law content into 20 sub-categories",
            "stagingBucket": f"gs://{bucket_name}",
            "requirements": [
                "google-cloud-aiplatform>=1.60.0",
                "google-genai>=1.0.0",
                "cloudpickle>=3.0.0",
                "pydantic>=2.0.0",
            ],
            "extraPackages": ["./labeling_agent"],
            "agentFramework": "custom",
        },
    )

    resource_name = remote_agent.name
    print(f"\nAgent deployed successfully!")
    print(f"  Resource name: {resource_name}")
    print()
    print("Add this to your .env file:")
    print(f"  AGENT_ENGINE_RESOURCE_NAME={resource_name}")

    # Quick test
    print("\nTesting deployed agent...")
    result = remote_agent.query(
        content="The H-1B visa cap is 65,000 per year with a 20,000 master's cap.",
        source_url="https://www.uscis.gov/h-1b",
    )
    print(f"  Test result: {result}")


if __name__ == "__main__":
    main()
