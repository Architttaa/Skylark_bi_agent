import { NextResponse } from 'next/server';
import { getCleanDeals, getCleanWorkOrders } from '@/lib/normalize';

export async function GET() {
  try {
    const deals = await getCleanDeals();
    const workOrders = await getCleanWorkOrders();
    return NextResponse.json({ deals, workOrders });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch clean records from monday.com:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
