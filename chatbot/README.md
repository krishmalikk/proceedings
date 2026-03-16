# Immigration Law Firm FAQ Chatbot

A simple, beginner-friendly FAQ chatbot that answers questions based on your law firm's documents. Built with LlamaIndex, ChromaDB, and Claude AI.

## What This Does

1. **Reads your FAQ documents** (PDF, TXT, or Markdown files)
2. **Stores them in a local database** (ChromaDB - no cloud needed)
3. **Answers questions** using Claude AI, but ONLY from your documents
4. **Stays safe** - never gives legal advice, just FAQ information

---

## Prerequisites

Before you start, make sure you have:

- **Python 3.9 or higher** - [Download Python](https://www.python.org/downloads/)
- **An Anthropic API key** - [Get one here](https://console.anthropic.com/)

To check your Python version, open Terminal and run:
```bash
python3 --version
```

---

## Quick Start Guide

### Step 1: Set Up Your Environment

Open Terminal and navigate to the chatbot folder:
```bash
cd path/to/lawconsulting/chatbot
```

Create a virtual environment (keeps dependencies isolated):
```bash
python3 -m venv venv
```

Activate the virtual environment:
```bash
# On Mac/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

You should see `(venv)` at the start of your terminal prompt.

### Step 2: Install Dependencies

Install all required packages:
```bash
pip install -r requirements.txt
```

This will take a few minutes the first time.

### Step 3: Configure Your Settings

Copy the example configuration file:
```bash
cp .env.example .env
```

Open `.env` in a text editor and add your settings:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
FIRM_NAME=Smith & Associates Immigration Law
```

### Step 4: Add Your FAQ Documents

Place your FAQ documents in the `data/faq/` folder:
```
chatbot/
  data/
    faq/
      your-faq-document.pdf
      another-document.txt
      more-info.md
```

Supported formats: **PDF**, **TXT**, **Markdown (.md)**

Sample documents are included to get you started.

### Step 5: Run the Ingestion Script

This reads your documents and prepares them for the chatbot:
```bash
python ingest.py
```

You should see output like:
```
==================================================
  FAQ Document Ingestion Script
==================================================

Step 1: Setting up embedding model...
Step 2: Setting up document chunking...
Step 3: Loading FAQ documents...
Step 4: Initializing ChromaDB...
Step 5: Embedding and indexing documents...

==================================================
  SUCCESS!
==================================================
Indexed 2 document(s) into the 'law_firm_faq' collection.
```

### Step 6: Start the Chatbot

Now you can run the chatbot:
```bash
python chatbot.py
```

Example conversation:
```
==================================================
  Welcome to Smith & Associates FAQ Assistant
==================================================

I'm here to help answer your questions based on our FAQ.
Type your question and press Enter.
Type 'quit' or 'exit' to end the conversation.
--------------------------------------------------

You: What is an H-1B visa?
Assistant: The H-1B visa is a nonimmigrant visa that allows U.S. employers 
to temporarily employ foreign workers in specialty occupations. These are 
positions that typically require at least a bachelor's degree in a specific 
field. Please consult with an attorney for advice specific to your situation.

You: quit

Thank you for using our FAQ assistant. Goodbye!
```

---

## File Structure

```
chatbot/
├── data/
│   └── faq/                  # Your FAQ documents go here
├── chroma_db/                # Database (created automatically)
├── ingest.py                 # Run this to index documents
├── chatbot.py                # Run this to start chatbot
├── system_prompt.txt         # Customize the AI personality
├── requirements.txt          # Python dependencies
├── .env.example              # Configuration template
└── README.md                 # This file
```

---

## Customizing the System Prompt

Edit `system_prompt.txt` to change how the chatbot responds:

- Change `{FIRM_NAME}` behavior by setting `FIRM_NAME` in `.env`
- Adjust the tone and guidelines
- Modify the fallback message

After editing, restart the chatbot to see changes.

---

## Updating Your FAQ

When you add or change documents:

1. Add/update files in `data/faq/`
2. Re-run the ingestion script:
   ```bash
   python ingest.py
   ```
3. Restart the chatbot

---

## Troubleshooting

### "No module named..." error
Make sure you activated the virtual environment:
```bash
source venv/bin/activate
```

### "ANTHROPIC_API_KEY not found" error
Make sure you:
1. Created the `.env` file: `cp .env.example .env`
2. Added your actual API key to the file

### "ChromaDB collection not found" error
Run the ingestion script first:
```bash
python ingest.py
```

### "No documents found" error
Add PDF, TXT, or MD files to the `data/faq/` folder.

---

## How It Works (Technical Details)

1. **Ingestion (ingest.py)**:
   - Reads documents from `data/faq/`
   - Splits them into smaller chunks (512 characters each)
   - Converts chunks to embeddings using a local AI model
   - Stores embeddings in ChromaDB

2. **Querying (chatbot.py)**:
   - Takes your question
   - Converts it to an embedding
   - Finds the 3 most similar chunks in ChromaDB
   - Sends those chunks + your question to Claude
   - Claude generates a response based ONLY on those chunks

This is called **RAG** (Retrieval-Augmented Generation).

---

## License

MIT License - feel free to use and modify for your firm.

