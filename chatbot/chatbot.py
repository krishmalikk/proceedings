"""
chatbot.py - Interactive FAQ Chatbot

This script runs an interactive terminal chatbot that answers questions
based on the FAQ documents you've ingested using ingest.py.

The chatbot:
- Uses Claude claude-sonnet-4-20250514 (Anthropic's AI model) to generate responses
- Only answers based on your FAQ documents
- Maintains a friendly, professional tone

Usage:
    python chatbot.py

Prerequisites:
    1. Run ingest.py first to index your FAQ documents
    2. Set ANTHROPIC_API_KEY in your .env file
    3. Optionally set FIRM_NAME in your .env file
"""

# === IMPORTS ===
import os
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv

# LlamaIndex components for querying
from llama_index.core import VectorStoreIndex, Settings
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.anthropic import Anthropic

# ChromaDB for loading the vector store
import chromadb
from llama_index.vector_stores.chroma import ChromaVectorStore


# === CONFIGURATION ===
# Load environment variables
load_dotenv()

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent

# Where the ChromaDB database is stored
CHROMA_DIR = BASE_DIR / "chroma_db"

# Name of the ChromaDB collection
COLLECTION_NAME = "law_firm_faq"

# Path to the system prompt file
SYSTEM_PROMPT_FILE = BASE_DIR / "system_prompt.txt"

# Embedding model (MUST match the one used in ingest.py!)
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# === FUNCTIONS ===

def load_system_prompt():
    """
    Load and customize the system prompt from file.

    This function:
    1. Reads the system_prompt.txt file
    2. Replaces {FIRM_NAME} with the value from your .env file

    Returns:
        str: The customized system prompt

    Raises:
        FileNotFoundError: If system_prompt.txt doesn't exist
    """
    if not SYSTEM_PROMPT_FILE.exists():
        raise FileNotFoundError(
            f"System prompt file not found: {SYSTEM_PROMPT_FILE}\n"
            "Please create system_prompt.txt in the chatbot folder."
        )

    # Read the prompt template
    prompt = SYSTEM_PROMPT_FILE.read_text()

    # Replace the firm name placeholder
    firm_name = os.getenv("FIRM_NAME", "Our Law Firm")
    prompt = prompt.replace("{FIRM_NAME}", firm_name)

    return prompt


def load_vector_store():
    """
    Load the ChromaDB collection created by ingest.py.

    This function:
    1. Connects to the existing ChromaDB database
    2. Gets the law_firm_faq collection
    3. Wraps it for use with LlamaIndex

    Returns:
        ChromaVectorStore: The loaded vector store

    Raises:
        RuntimeError: If the collection doesn't exist (ingest.py not run)
    """
    # Check if the database directory exists
    if not CHROMA_DIR.exists():
        raise RuntimeError(
            "\nChromaDB database not found!\n"
            "Please run ingest.py first to index your FAQ documents:\n"
            "  python ingest.py\n"
        )

    # Connect to existing ChromaDB
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # Try to get the existing collection
    try:
        collection = client.get_collection(name=COLLECTION_NAME)
    except Exception:
        raise RuntimeError(
            f"\nCollection '{COLLECTION_NAME}' not found!\n"
            "Please run ingest.py first to index your FAQ documents:\n"
            "  python ingest.py\n"
        )

    # Check if the collection has any data
    if collection.count() == 0:
        raise RuntimeError(
            "\nThe FAQ collection is empty!\n"
            "Please add documents to data/faq/ and run ingest.py\n"
        )

    print(f"  Loaded {collection.count()} chunks from ChromaDB")

    # Wrap in LlamaIndex vector store
    vector_store = ChromaVectorStore(chroma_collection=collection)

    return vector_store


def create_query_engine(vector_store, system_prompt):
    """
    Create the query engine for answering questions.

    This function:
    1. Sets up Claude claude-sonnet-4-20250514 as the language model
    2. Configures the same embedding model used for ingestion
    3. Creates an index from the vector store
    4. Returns a query engine with the system prompt

    Args:
        vector_store: The ChromaDB vector store
        system_prompt: The customized system prompt

    Returns:
        QueryEngine: Ready to answer questions

    Raises:
        ValueError: If ANTHROPIC_API_KEY is not set
    """
    # Get the Anthropic API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "\nANTHROPIC_API_KEY not found!\n"
            "Please add your API key to the .env file:\n"
            "  ANTHROPIC_API_KEY=your-key-here\n"
        )

    # Set up Claude as the language model
    print("  Connecting to Claude claude-sonnet-4-20250514...")
    Settings.llm = Anthropic(
        model="claude-sonnet-4-20250514",
        api_key=api_key,
        max_tokens=1024,      # Maximum length of response
        temperature=0.3,      # Lower = more focused/deterministic
    )

    # Set up the same embedding model used during ingestion
    # (This is important - must match ingest.py!)
    Settings.embed_model = HuggingFaceEmbedding(model_name=EMBEDDING_MODEL)

    # Create index from the existing vector store
    print("  Building query engine...")
    index = VectorStoreIndex.from_vector_store(vector_store)

    # Create the query engine with our system prompt
    query_engine = index.as_query_engine(
        similarity_top_k=3,         # Retrieve top 3 relevant chunks
        system_prompt=system_prompt,
    )

    return query_engine


def print_welcome():
    """Print a friendly welcome message."""
    firm_name = os.getenv("FIRM_NAME", "Our Law Firm")

    print("\n" + "=" * 50)
    print(f"  Welcome to {firm_name} FAQ Assistant")
    print("=" * 50)
    print("\nI'm here to help answer your questions based on our FAQ.")
    print("Type your question and press Enter.")
    print("Type 'quit' or 'exit' to end the conversation.")
    print("-" * 50)


def main():
    """
    Main chatbot loop.

    This function:
    1. Loads the system prompt
    2. Connects to the ChromaDB vector store
    3. Creates the query engine
    4. Runs an interactive loop for questions

    The user can type 'quit' or 'exit' to end the session.
    """
    print("\n  Starting FAQ Chatbot...")
    print("-" * 50)

    # Step 1: Load the system prompt
    print("\n  Loading system prompt...")
    system_prompt = load_system_prompt()
    print("  System prompt loaded!")

    # Step 2: Load the vector store
    print("\n  Loading FAQ database...")
    vector_store = load_vector_store()
    print("  Database loaded!")

    # Step 3: Create the query engine
    print("\n  Initializing AI...")
    query_engine = create_query_engine(vector_store, system_prompt)
    print("  AI ready!")

    # Step 4: Show welcome message
    print_welcome()

    # Step 5: Interactive chat loop
    while True:
        # Get user input
        try:
            question = input("\nYou: ").strip()
        except (KeyboardInterrupt, EOFError):
            # Handle Ctrl+C or Ctrl+D gracefully
            print("\n\nGoodbye!")
            break

        # Check for exit commands
        if question.lower() in ['quit', 'exit', 'q', 'bye']:
            print("\nThank you for using our FAQ assistant. Goodbye!")
            break

        # Skip empty questions
        if not question:
            print("Assistant: Please type a question, or 'quit' to exit.")
            continue

        # Get and print the response
        try:
            print("\nAssistant: ", end="", flush=True)
            response = query_engine.query(question)
            print(response)
        except Exception as e:
            print(f"I apologize, but I encountered an error: {e}")
            print("Please try again or contact our office directly.")


# === RUN THE SCRIPT ===
if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, RuntimeError, ValueError) as e:
        print(e)
        exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        print("\nIf you're seeing import errors, make sure you've installed dependencies:")
        print("  pip install -r requirements.txt")
        exit(1)
