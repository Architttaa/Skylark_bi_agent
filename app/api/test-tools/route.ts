import { NextResponse } from 'next/server';
import {
  getPipelineBySector,
  getRevenueSummary,
  getWorkOrderStatus,
  getDataQualitySummary,
  listCanonicalSectors,
} from '@/lib/tools';

export async function GET() {
  try {
    const pipeline = await getPipelineBySector();
    const revenue = await getRevenueSummary();
    const workOrderStatus = await getWorkOrderStatus();
    const dataQuality = await getDataQualitySummary();
    const sectors = await listCanonicalSectors();

    return NextResponse.json({
      pipeline,
      revenue,
      workOrderStatus,
      dataQuality,
      sectors,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to execute test-tools route:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
