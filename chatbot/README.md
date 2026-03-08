# Immigration Law Firm FAQ Chatbot

A RAG-based (Retrieval Augmented Generation) chatbot for answering immigration-related FAQs. Built with LlamaIndex and powered by Claude claude-sonnet-4-20250514 or GPT-4o.

## Features

- **Document Ingestion**: Automatically ingests PDF, TXT, MD, and DOCX files from the `faq_documents` folder
- **Local Vector Store**: Uses a local vector store for embeddings (no external database required)
- **Privacy-Focused**: Uses local HuggingFace embeddings for document processing
- **Flexible LLM**: Supports both Claude (Anthropic) and GPT-4o (OpenAI)
- **Safety Guardrails**: Only answers from FAQ documents, never provides legal advice

## Setup

### 1. Create a virtual environment

```bash
cd chatbot
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key-here
```

Or for OpenAI:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
```

### 4. Add FAQ documents

Place your FAQ documents in the `faq_documents` folder. Supported formats:
- PDF (`.pdf`)
- Text files (`.txt`)
- Markdown (`.md`)
- Word documents (`.docx`)

Sample FAQ documents are included for testing.

### 5. Run the server

```bash
python api_server.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Chat
```
POST /chat
Content-Type: application/json

{
  "message": "What is an H-1B visa?"
}
```

### Reload Documents
```
POST /reload
```

## API Documentation

When the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Chatbot Behavior

The chatbot is designed with the following guardrails:

1. **Only answers from FAQ documents**: Will not provide information outside the loaded documents
2. **No legal advice**: Only provides general information, always recommends consulting with the firm
3. **Professional tone**: Responses are friendly, clear, and professional
4. **Concise answers**: Keeps responses to 3-5 sentences unless more detail is needed
5. **Safe fallback**: If answer not found, directs users to contact the office

## Adding Custom FAQ Documents

1. Add your documents to the `faq_documents` folder
2. Call the `/reload` endpoint or restart the server
3. The chatbot will re-index all documents

## Vector Store

The vector store is persisted in the `vector_store` folder. To reset:

```bash
rm -rf vector_store
```

The next time the server starts, it will re-index all documents.
