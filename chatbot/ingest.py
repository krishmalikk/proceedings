"""
ingest.py - Document Ingestion Script for FAQ Chatbot

This script reads FAQ documents (PDF, TXT, MD files) from the data/faq folder,
breaks them into smaller chunks, converts them into embeddings (numerical
representations), and stores them in a ChromaDB vector database.

Run this script once after adding or updating your FAQ documents.

Usage:
    python ingest.py
"""

# === IMPORTS ===
# Standard library imports for file and path handling
import os
from pathlib import Path

# Load environment variables from .env file
from dotenv import load_dotenv

# LlamaIndex: A framework for building LLM applications with your data
from llama_index.core import (
    SimpleDirectoryReader,  # Reads documents from a folder
    VectorStoreIndex,       # Creates searchable index from documents
    StorageContext,         # Manages where data is stored
    Settings,               # Global settings for LlamaIndex
)
from llama_index.core.node_parser import SentenceSplitter  # Splits documents into chunks

# ChromaDB: A vector database for storing embeddings
import chromadb
from llama_index.vector_stores.chroma import ChromaVectorStore

# HuggingFace Embeddings: Converts text to numerical vectors (runs locally)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding


# === CONFIGURATION ===
# These settings control how the script works

# Load environment variables from .env file (if it exists)
load_dotenv()

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent

# Where to find FAQ documents (PDF, TXT, MD files)
DATA_DIR = BASE_DIR / "data" / "faq"

# Where to store the ChromaDB database
CHROMA_DIR = BASE_DIR / "chroma_db"

# Name of the ChromaDB collection (like a table in a database)
COLLECTION_NAME = "law_firm_faq"

# The embedding model to use (this runs locally, no API needed)
# all-MiniLM-L6-v2 is a small, fast model that works well for most use cases
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# How to split documents into chunks:
# - CHUNK_SIZE: Maximum number of characters per chunk
# - CHUNK_OVERLAP: Characters that overlap between chunks (helps maintain context)
CHUNK_SIZE = 512
CHUNK_OVERLAP = 50


# === FUNCTIONS ===

def setup_chromadb():
    """
    Initialize ChromaDB with persistent storage.

    This function:
    1. Creates a ChromaDB client that saves data to disk
    2. Deletes any existing collection (to start fresh)
    3. Creates a new empty collection
    4. Wraps it in a LlamaIndex-compatible format

    Returns:
        ChromaVectorStore: A vector store ready for LlamaIndex to use
    """
    print("  Creating ChromaDB persistent client...")

    # Create the directory if it doesn't exist
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    # PersistentClient saves data to disk automatically
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # Delete existing collection if it exists (to avoid duplicates)
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"  Deleted existing '{COLLECTION_NAME}' collection")
    except Exception:
        pass  # Collection doesn't exist yet, that's fine

    # Create a fresh collection
    collection = client.create_collection(name=COLLECTION_NAME)
    print(f"  Created new '{COLLECTION_NAME}' collection")

    # Wrap the ChromaDB collection in a LlamaIndex-compatible vector store
    vector_store = ChromaVectorStore(chroma_collection=collection)

    return vector_store


def load_documents():
    """
    Load all FAQ documents from the data/faq folder.

    This function:
    1. Checks if the data folder exists
    2. Uses SimpleDirectoryReader to load PDF, TXT, and MD files
    3. Returns a list of Document objects

    Returns:
        list: List of Document objects containing the FAQ content

    Raises:
        FileNotFoundError: If the data folder doesn't exist or is empty
    """
    # Check if the data folder exists
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        raise FileNotFoundError(
            f"\nNo data folder found!\n"
            f"Please add your FAQ documents (PDF, TXT, or MD files) to:\n"
            f"  {DATA_DIR}\n"
        )

    # Check if there are any supported files
    supported_extensions = [".pdf", ".txt", ".md"]
    files = [f for f in DATA_DIR.iterdir()
             if f.is_file() and f.suffix.lower() in supported_extensions]

    if not files:
        raise FileNotFoundError(
            f"\nNo documents found!\n"
            f"Please add PDF, TXT, or MD files to:\n"
            f"  {DATA_DIR}\n"
        )

    print(f"  Found {len(files)} document(s):")
    for f in files:
        print(f"    - {f.name}")

    # Load documents using SimpleDirectoryReader
    # This automatically handles PDF, TXT, and MD files
    reader = SimpleDirectoryReader(
        input_dir=str(DATA_DIR),
        recursive=True,  # Also look in subfolders
    )

    documents = reader.load_data()

    return documents


def main():
    """
    Main ingestion pipeline.

    This function orchestrates the entire ingestion process:
    1. Sets up the embedding model (for converting text to vectors)
    2. Sets up the text splitter (for chunking documents)
    3. Loads FAQ documents from the data folder
    4. Initializes ChromaDB for storage
    5. Creates a searchable index from the documents

    The index is automatically saved to the chroma_db folder.
    """
    print("\n" + "=" * 50)
    print("  FAQ Document Ingestion Script")
    print("=" * 50 + "\n")

    # Step 1: Configure the embedding model
    print("Step 1: Setting up embedding model...")
    print(f"  Using: {EMBEDDING_MODEL}")
    Settings.embed_model = HuggingFaceEmbedding(model_name=EMBEDDING_MODEL)
    print("  Embedding model ready!\n")

    # Step 2: Configure how documents are split into chunks
    print("Step 2: Setting up document chunking...")
    print(f"  Chunk size: {CHUNK_SIZE} characters")
    print(f"  Chunk overlap: {CHUNK_OVERLAP} characters")
    Settings.node_parser = SentenceSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )
    print("  Chunking configured!\n")

    # Step 3: Load documents
    print("Step 3: Loading FAQ documents...")
    documents = load_documents()
    print(f"  Loaded {len(documents)} document(s)!\n")

    # Step 4: Set up ChromaDB
    print("Step 4: Initializing ChromaDB...")
    vector_store = setup_chromadb()
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    print("  ChromaDB ready!\n")

    # Step 5: Create the index (this embeds and stores the documents)
    print("Step 5: Embedding and indexing documents...")
    print("  This may take a moment...")
    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,
    )

    # Done!
    print("\n" + "=" * 50)
    print("  SUCCESS!")
    print("=" * 50)
    print(f"\nIndexed {len(documents)} document(s) into the '{COLLECTION_NAME}' collection.")
    print(f"ChromaDB data stored in: {CHROMA_DIR}")
    print("\nYou can now run the chatbot:")
    print("  python chatbot.py")
    print()


# === RUN THE SCRIPT ===
# This block runs when you execute: python ingest.py
if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as e:
        print(e)
        exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        print("\nIf you're seeing import errors, make sure you've installed dependencies:")
        print("  pip install -r requirements.txt")
        exit(1)
