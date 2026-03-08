import { NextRequest, NextResponse } from 'next/server';

const CHATBOT_API_URL = process.env.CHATBOT_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: 'Message must be 1000 characters or less' },
        { status: 400 }
      );
    }

    // Forward request to Python chatbot API
    const response = await fetch(`${CHATBOT_API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Chatbot API error:', errorData);

      if (response.status === 503) {
        return NextResponse.json(
          {
            error: 'The chatbot is currently unavailable. Please try again later.',
            response: "I'm sorry, but I'm currently unavailable. Please contact our office directly for assistance."
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: 'An error occurred processing your request',
          response: "I apologize, but I encountered an error. Please try again or contact our office directly."
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in chat API route:', error);

    // Check if it's a connection error (chatbot server not running)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          error: 'Unable to connect to chatbot service',
          response: "I'm sorry, but I'm currently unavailable. Please contact our office directly for assistance."
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        response: "I apologize, but something went wrong. Please try again or contact our office directly."
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Health check endpoint
    const response = await fetch(`${CHATBOT_API_URL}/health`);

    if (!response.ok) {
      return NextResponse.json(
        { status: 'unhealthy', message: 'Chatbot service is not responding' },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', message: 'Unable to connect to chatbot service' },
      { status: 503 }
    );
  }
}
