import { NextResponse } from 'next/server';
import { getDealsRaw } from '@/lib/monday';

export async function GET() {
  try {
    const deals = await getDealsRaw();
    return NextResponse.json(deals);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch deals from monday.com:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
