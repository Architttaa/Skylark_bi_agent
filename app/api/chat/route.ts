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

    // Detect rate limit error signatures
    const isRateLimit =
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.toLowerCase().includes("too many requests") ||
      errorMessage.toLowerCase().includes("rate limit") ||
      errorMessage.toLowerCase().includes("quota exceeded");

    if (isRateLimit) {
      return NextResponse.json(
        {
          error:
            "Gemini API rate limit exceeded (Quota / Resource Exhausted). Please wait a moment before trying again.",
          code: "RATE_LIMIT",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: `Agent processing failed: ${errorMessage}`,
        code: "AGENT_FAILURE",
      },
      { status: 500 }
    );
  }
}
