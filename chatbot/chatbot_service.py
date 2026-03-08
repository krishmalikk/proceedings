"""
FAQ Chatbot Service for Immigration Law Firm
Uses LlamaIndex for document ingestion and retrieval
Powered by Claude claude-sonnet-4-20250514 (or OpenAI GPT-4o as fallback)
"""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from llama_index.core import (
    SimpleDirectoryReader,
    VectorStoreIndex,
    StorageContext,
    load_index_from_storage,
    Settings,
)
from llama_index.core.node_parser import SentenceSplitter
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.anthropic import Anthropic
from llama_index.llms.openai import OpenAI

load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
FAQ_DOCUMENTS_DIR = BASE_DIR / "faq_documents"
VECTOR_STORE_DIR = BASE_DIR / "vector_store"

# System prompt for the chatbot
SYSTEM_PROMPT = """You are a helpful FAQ assistant for an immigration law firm. Your role is to provide general information based ONLY on the FAQ documents you have been given.

IMPORTANT RULES:
1. ONLY answer questions based on the information in the FAQ documents provided.
2. If the answer is not in the documents, respond with: "I don't have that information in our FAQ. Please contact our office directly for assistance."
3. NEVER provide specific legal advice - only general information from the FAQ.
4. Be friendly, clear, and professional in your responses.
5. Keep answers concise (3-5 sentences maximum) unless more detail is absolutely necessary.
6. If asked about specific case details, fees not in the FAQ, or legal strategy, politely redirect them to contact the office.
7. Always remind users that this is general information and not legal advice when appropriate.

Remember: You are an information assistant, not a lawyer. Your job is to help users find answers from the FAQ, not to give legal counsel."""


class FAQChatbot:
    """FAQ Chatbot using LlamaIndex for RAG-based Q&A"""

    def __init__(self, llm_provider: str = "anthropic"):
        """
        Initialize the FAQ Chatbot

        Args:
            llm_provider: Either "anthropic" for Claude or "openai" for GPT-4o
        """
        self.llm_provider = llm_provider
        self.index: Optional[VectorStoreIndex] = None
        self.query_engine = None

        # Set up embedding model (using local HuggingFace model for privacy)
        Settings.embed_model = HuggingFaceEmbedding(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

        # Set up LLM
        self._setup_llm()

        # Set up node parser for chunking
        Settings.node_parser = SentenceSplitter(
            chunk_size=512,
            chunk_overlap=50
        )

    def _setup_llm(self):
        """Configure the LLM based on provider"""
        if self.llm_provider == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY environment variable not set")
            Settings.llm = Anthropic(
                model="claude-sonnet-4-20250514",
                api_key=api_key,
                max_tokens=1024,
                temperature=0.3,  # Lower temperature for more factual responses
            )
        elif self.llm_provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            Settings.llm = OpenAI(
                model="gpt-4o",
                api_key=api_key,
                max_tokens=1024,
                temperature=0.3,
            )
        else:
            raise ValueError(f"Unknown LLM provider: {self.llm_provider}")

    def ingest_documents(self, force_reload: bool = False) -> int:
        """
        Ingest FAQ documents from the documents directory

        Args:
            force_reload: If True, re-ingest documents even if vector store exists

        Returns:
            Number of documents ingested
        """
        # Check if vector store already exists
        if not force_reload and VECTOR_STORE_DIR.exists():
            print("Loading existing vector store...")
            storage_context = StorageContext.from_defaults(
                persist_dir=str(VECTOR_STORE_DIR)
            )
            self.index = load_index_from_storage(storage_context)
            self._setup_query_engine()
            return 0  # Loaded from cache

        # Ensure documents directory exists
        if not FAQ_DOCUMENTS_DIR.exists():
            FAQ_DOCUMENTS_DIR.mkdir(parents=True)
            raise FileNotFoundError(
                f"Please add FAQ documents to: {FAQ_DOCUMENTS_DIR}"
            )

        # Check if there are any documents
        doc_files = list(FAQ_DOCUMENTS_DIR.glob("*"))
        doc_files = [f for f in doc_files if f.suffix.lower() in ['.pdf', '.txt', '.md', '.docx']]

        if not doc_files:
            raise FileNotFoundError(
                f"No documents found in {FAQ_DOCUMENTS_DIR}. "
                "Please add PDF, TXT, MD, or DOCX files."
            )

        print(f"Ingesting {len(doc_files)} documents...")

        # Load documents
        reader = SimpleDirectoryReader(
            input_dir=str(FAQ_DOCUMENTS_DIR),
            recursive=True,
            filename_as_id=True,
        )
        documents = reader.load_data()

        # Create index
        self.index = VectorStoreIndex.from_documents(
            documents,
            show_progress=True,
        )

        # Persist to disk
        VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
        self.index.storage_context.persist(persist_dir=str(VECTOR_STORE_DIR))

        print(f"Successfully ingested {len(documents)} documents")

        # Set up query engine
        self._setup_query_engine()

        return len(documents)

    def _setup_query_engine(self):
        """Set up the query engine with custom prompts"""
        if self.index is None:
            raise ValueError("Index not initialized. Call ingest_documents first.")

        # Create query engine with custom settings
        self.query_engine = self.index.as_query_engine(
            similarity_top_k=3,  # Retrieve top 3 most relevant chunks
            response_mode="compact",  # Compact response synthesis
            system_prompt=SYSTEM_PROMPT,
        )

    def ask(self, question: str) -> str:
        """
        Ask a question to the chatbot

        Args:
            question: The user's question

        Returns:
            The chatbot's response
        """
        if self.query_engine is None:
            raise ValueError("Chatbot not initialized. Call ingest_documents first.")

        try:
            response = self.query_engine.query(question)
            return str(response)
        except Exception as e:
            print(f"Error processing question: {e}")
            return (
                "I apologize, but I encountered an error processing your question. "
                "Please try rephrasing or contact our office directly for assistance."
            )

    def reload_documents(self) -> int:
        """Force reload of all documents"""
        return self.ingest_documents(force_reload=True)


# Singleton instance for the API
_chatbot_instance: Optional[FAQChatbot] = None


def get_chatbot(llm_provider: str = "anthropic") -> FAQChatbot:
    """Get or create the chatbot singleton instance"""
    global _chatbot_instance

    if _chatbot_instance is None:
        _chatbot_instance = FAQChatbot(llm_provider=llm_provider)
        try:
            _chatbot_instance.ingest_documents()
        except FileNotFoundError as e:
            print(f"Warning: {e}")
            # Continue anyway - documents can be added later

    return _chatbot_instance
