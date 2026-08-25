import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Missing 'message' in request body." },
        { status: 400 }
      );
    }

    const formattedHistory = Array.isArray(history) ? history : [];

    const result = await runAgent(message, formattedHistory);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Gemini Agent API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // 1. Detect AI rate limit / quota issues
    const isRateLimit =
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.toLowerCase().includes("too many requests") ||
      errorMessage.toLowerCase().includes("rate limit") ||
      errorMessage.toLowerCase().includes("quota exceeded");

    if (isRateLimit) {
      return NextResponse.json(
        {
          error: "the AI service is busy, please wait a moment and try again",
          code: "RATE_LIMIT",
        },
        { status: 429 }
      );
    }

    // 2. Detect Monday.com connectivity / authentication issues
    const isMondayError =
      errorMessage.toLowerCase().includes("monday.com data unavailable") ||
      errorMessage.toLowerCase().includes("monday.com api") ||
      errorMessage.toLowerCase().includes("unreachable") ||
      errorMessage.toLowerCase().includes("invalid token") ||
      errorMessage.toLowerCase().includes("board id") ||
      errorMessage.toLowerCase().includes("board not found");

    if (isMondayError) {
      return NextResponse.json(
        {
          error: "live business data is temporarily unavailable",
          code: "MONDAY_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // 3. Fallback for any other unexpected failures - hide internal logs / traces
    return NextResponse.json(
      {
        error: "something went wrong, please try again",
        code: "UNKNOWN_FAILURE",
      },
      { status: 500 }
    );
  }
}
