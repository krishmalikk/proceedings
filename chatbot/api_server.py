"""
FastAPI server for the FAQ Chatbot
Provides REST API endpoints for the chatbot functionality
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from chatbot_service import FAQChatbot, get_chatbot

load_dotenv()


# Request/Response models
class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str = Field(..., min_length=1, max_length=1000, description="The user's question")


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    response: str = Field(..., description="The chatbot's response")
    success: bool = Field(default=True, description="Whether the request was successful")


class ReloadResponse(BaseModel):
    """Response model for reload endpoint"""
    message: str
    documents_loaded: int


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    llm_provider: str
    documents_loaded: bool


# Global chatbot instance
chatbot: Optional[FAQChatbot] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app"""
    global chatbot

    # Startup: Initialize chatbot
    print("Initializing FAQ Chatbot...")

    # Determine LLM provider from environment
    llm_provider = os.getenv("LLM_PROVIDER", "anthropic").lower()

    try:
        chatbot = get_chatbot(llm_provider=llm_provider)
        print(f"Chatbot initialized with {llm_provider} provider")
    except Exception as e:
        print(f"Warning: Could not fully initialize chatbot: {e}")
        print("The chatbot will be available once documents are added and reloaded.")

    yield

    # Shutdown
    print("Shutting down FAQ Chatbot...")


# Create FastAPI app
app = FastAPI(
    title="Immigration FAQ Chatbot API",
    description="A chatbot API for answering immigration-related FAQs",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://127.0.0.1:3000",
        "https://proceedings.io",  # Production domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    global chatbot

    return HealthResponse(
        status="healthy",
        llm_provider=os.getenv("LLM_PROVIDER", "anthropic"),
        documents_loaded=chatbot is not None and chatbot.index is not None,
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the chatbot and receive a response

    The chatbot will only answer based on the FAQ documents loaded.
    If the answer is not found, it will suggest contacting the office.
    """
    global chatbot

    if chatbot is None:
        raise HTTPException(
            status_code=503,
            detail="Chatbot not initialized. Please try again later.",
        )

    if chatbot.query_engine is None:
        raise HTTPException(
            status_code=503,
            detail="No FAQ documents loaded. Please contact the administrator.",
        )

    try:
        response = chatbot.ask(request.message)
        return ChatResponse(response=response, success=True)
    except Exception as e:
        print(f"Error processing chat request: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred processing your request. Please try again.",
        )


@app.post("/reload", response_model=ReloadResponse)
async def reload_documents():
    """
    Reload FAQ documents from the documents directory

    This endpoint should be called after adding or updating FAQ documents.
    It will re-index all documents and update the vector store.
    """
    global chatbot

    if chatbot is None:
        raise HTTPException(
            status_code=503,
            detail="Chatbot not initialized.",
        )

    try:
        num_docs = chatbot.reload_documents()
        return ReloadResponse(
            message="Documents reloaded successfully",
            documents_loaded=num_docs,
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except Exception as e:
        print(f"Error reloading documents: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error reloading documents: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("CHATBOT_PORT", "8000"))
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
