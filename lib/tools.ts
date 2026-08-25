import { getCleanDeals, getCleanWorkOrders, NormalizedDeal, NormalizedWorkOrder } from "./normalize";

// Startup environment checks
const requiredEnvVars = [
  "MONDAY_API_TOKEN",
  "MONDAY_DEALS_BOARD_ID",
  "MONDAY_WORK_ORDERS_BOARD_ID",
  "GEMINI_API_KEY",
];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`[WARNING] Missing required environment variable: ${key}`);
  }
}

// Safety wrappers to intercept Monday API errors and return uniform messages
async function fetchDealsSafely(): Promise<NormalizedDeal[]> {
  try {
    return await getCleanDeals();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`monday.com data unavailable: ${msg}`);
  }
}

async function fetchWorkOrdersSafely(): Promise<NormalizedWorkOrder[]> {
  try {
    return await getCleanWorkOrders();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`monday.com data unavailable: ${msg}`);
  }
}

export interface StageBreakdownEntry {
  count: number;
  value: number;
}

export interface SectorBreakdownEntry {
  count: number;
  value: number;
}

export async function getPipelineBySector(
  sector?: string,
  quarter?: string
): Promise<
  | {
      totalDealCount: number;
      totalDealValue: number;
      stageBreakdown: Record<string, StageBreakdownEntry>;
      sectorBreakdown?: Record<string, SectorBreakdownEntry>;
      caveats: string[];
    }
  | { error: string }
> {
  try {
    const deals = await fetchDealsSafely();
    const caveats: string[] = [];

    caveats.push(
      "Note: closeDateA is null for open deals, so tentativeCloseDate was used for quarter filtering."
    );

    let filtered = deals.filter(
      (d) => d.dealStatus?.toLowerCase() === "open"
    );

    let excludedDueToCloseDate = 0;
    let excludedDueToValue = 0;

    if (sector) {
      filtered = filtered.filter(
        (d) => d.sector?.toLowerCase() === sector.toLowerCase()
      );
    }

    if (quarter) {
      const qMatch = quarter.match(/^Q([1-4])-(\d{4})$/i);
      if (!qMatch) {
        return {
          error: `Invalid quarter format: ${quarter}. Expected format example: Q1-2026`,
        };
      }
      const targetQuarter = parseInt(qMatch[1], 10);
      const targetYear = parseInt(qMatch[2], 10);

      filtered = filtered.filter((d) => {
        if (!d.tentativeCloseDate) {
          excludedDueToCloseDate++;
          return false;
        }
        const date = new Date(d.tentativeCloseDate);
        if (isNaN(date.getTime())) {
          excludedDueToCloseDate++;
          return false;
        }
        const y = date.getUTCFullYear();
        const m = date.getUTCMonth() + 1;
        const q = Math.ceil(m / 3);
        return y === targetYear && q === targetQuarter;
      });
    }

    let totalDealValue = 0;
    const stageBreakdown: Record<string, StageBreakdownEntry> = {};
    const sectorBreakdown: Record<string, SectorBreakdownEntry> = {};

    for (const d of filtered) {
      const val = d.dealValue;
      if (val === null) {
        excludedDueToValue++;
      } else {
        totalDealValue += val;
      }

      const stage = d.dealStage || "Unknown";
      if (!stageBreakdown[stage]) {
        stageBreakdown[stage] = { count: 0, value: 0 };
      }
      stageBreakdown[stage].count++;
      if (val !== null) {
        stageBreakdown[stage].value += val;
      }

      if (!sector) {
        const sec = d.sector || "Unknown";
        if (!sectorBreakdown[sec]) {
          sectorBreakdown[sec] = { count: 0, value: 0 };
        }
        sectorBreakdown[sec].count++;
        if (val !== null) {
          sectorBreakdown[sec].value += val;
        }
      }
    }

    if (excludedDueToCloseDate > 0) {
      caveats.push(
        `Excluded ${excludedDueToCloseDate} deals due to missing or invalid tentativeCloseDate.`
      );
    }
    if (excludedDueToValue > 0) {
      caveats.push(
        `Excluded ${excludedDueToValue} deals from the total value sum due to missing dealValue.`
      );
    }

    const response: {
      totalDealCount: number;
      totalDealValue: number;
      stageBreakdown: Record<string, StageBreakdownEntry>;
      sectorBreakdown?: Record<string, SectorBreakdownEntry>;
      caveats: string[];
    } = {
      totalDealCount: filtered.length,
      totalDealValue,
      stageBreakdown,
      caveats,
    };

    if (!sector) {
      response.sectorBreakdown = sectorBreakdown;
    }

    return response;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.startsWith("monday.com data unavailable:")) {
      return { error: errorMessage };
    }
    return { error: `Failed to calculate pipeline summary: ${errorMessage}` };
  }
}

export async function getRevenueSummary(
  period?: string
): Promise<
  | {
      totalBilledValueInclGst: number;
      totalCollectedAmountInclGst: number;
      totalAmountReceivable: number;
      recordCount: number;
      caveats: string[];
    }
  | { error: string }
> {
  try {
    const workOrders = await fetchWorkOrdersSafely();
    let filtered = workOrders;

    if (period) {
      const pLower = period.toLowerCase();
      filtered = workOrders.filter(
        (w) =>
          w.actualBillingMonth?.toLowerCase() === pLower ||
          w.expectedBillingMonth?.toLowerCase() === pLower
      );
    }

    let totalBilledValueInclGst = 0;
    let totalCollectedAmountInclGst = 0;
    let totalAmountReceivable = 0;

    let excludedBilled = 0;
    let excludedCollected = 0;
    let excludedReceivable = 0;

    for (const w of filtered) {
      if (w.billedValueInclGst === null) {
        excludedBilled++;
      } else {
        totalBilledValueInclGst += w.billedValueInclGst;
      }

      if (w.collectedAmountInclGst === null) {
        excludedCollected++;
      } else {
        totalCollectedAmountInclGst += w.collectedAmountInclGst;
      }

      if (w.amountReceivable === null) {
        excludedReceivable++;
      } else {
        totalAmountReceivable += w.amountReceivable;
      }
    }

    const caveats: string[] = [];
    if (excludedBilled > 0) {
      caveats.push(
        `Excluded ${excludedBilled} work orders due to missing billedValueInclGst.`
      );
    }
    if (excludedCollected > 0) {
      caveats.push(
        `Excluded ${excludedCollected} work orders due to missing collectedAmountInclGst.`
      );
    }
    if (excludedReceivable > 0) {
      caveats.push(
        `Excluded ${excludedReceivable} work orders due to missing amountReceivable.`
      );
    }

    return {
      totalBilledValueInclGst,
      totalCollectedAmountInclGst,
      totalAmountReceivable,
      recordCount: filtered.length,
      caveats,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.startsWith("monday.com data unavailable:")) {
      return { error: errorMessage };
    }
    return { error: `Failed to calculate revenue summary: ${errorMessage}` };
  }
}

export interface WorkOrderStatusRecord {
  name: string;
  executionStatus: string | null;
  sector: string | null;
  amountExclGst: number | null;
  amountInclGst: number | null;
  billedValueExclGst: number | null;
  billedValueInclGst: number | null;
  collectedAmountInclGst: number | null;
  amountToBeBilledExclGst: number | null;
  amountToBeBilledInclGst: number | null;
  amountReceivable: number | null;
}

export async function getWorkOrderStatus(
  sector?: string,
  status?: string
): Promise<
  | {
      count: number;
      records: WorkOrderStatusRecord[];
      caveats: string[];
    }
  | { error: string }
> {
  try {
    const workOrders = await fetchWorkOrdersSafely();
    let filtered = workOrders;

    if (sector) {
      filtered = filtered.filter(
        (w) => w.sector?.toLowerCase() === sector.toLowerCase()
      );
    }

    if (status) {
      const sLower = status.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.executionStatus &&
          w.executionStatus.toLowerCase().includes(sLower)
      );
    }

    const records = filtered.map((w) => ({
      name: w.name,
      executionStatus: w.executionStatus,
      sector: w.sector,
      amountExclGst: w.amountExclGst,
      amountInclGst: w.amountInclGst,
      billedValueExclGst: w.billedValueExclGst,
      billedValueInclGst: w.billedValueInclGst,
      collectedAmountInclGst: w.collectedAmountInclGst,
      amountToBeBilledExclGst: w.amountToBeBilledExclGst,
      amountToBeBilledInclGst: w.amountToBeBilledInclGst,
      amountReceivable: w.amountReceivable,
    }));

    let missingAmountsCount = 0;
    for (const w of filtered) {
      if (
        w.amountExclGst === null ||
        w.amountInclGst === null ||
        w.billedValueInclGst === null ||
        w.collectedAmountInclGst === null ||
        w.amountReceivable === null
      ) {
        missingAmountsCount++;
      }
    }

    const caveats: string[] = [];
    if (missingAmountsCount > 0) {
      caveats.push(
        `${missingAmountsCount} matching work orders have one or more missing financial values (billed, collected, receivable, or amount).`
      );
    }

    return {
      count: filtered.length,
      records,
      caveats,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.startsWith("monday.com data unavailable:")) {
      return { error: errorMessage };
    }
    return { error: `Failed to retrieve work order status: ${errorMessage}` };
  }
}

export async function getDataQualitySummary(): Promise<
  | {
      deals: {
        totalRecords: number;
        flagsSummary: Record<string, number>;
      };
      workOrders: {
        totalRecords: number;
        flagsSummary: Record<string, number>;
      };
    }
  | { error: string }
> {
  try {
    const deals = await fetchDealsSafely();
    const workOrders = await fetchWorkOrdersSafely();

    const dealFlagsSummary: Record<string, number> = {};
    const workOrderFlagsSummary: Record<string, number> = {};

    for (const d of deals) {
      for (const flag of d.dataQualityFlags) {
        dealFlagsSummary[flag] = (dealFlagsSummary[flag] || 0) + 1;
      }
    }

    for (const w of workOrders) {
      for (const flag of w.dataQualityFlags) {
        workOrderFlagsSummary[flag] = (workOrderFlagsSummary[flag] || 0) + 1;
      }
    }

    return {
      deals: {
        totalRecords: deals.length,
        flagsSummary: dealFlagsSummary,
      },
      workOrders: {
        totalRecords: workOrders.length,
        flagsSummary: workOrderFlagsSummary,
      },
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.startsWith("monday.com data unavailable:")) {
      return { error: errorMessage };
    }
    return { error: `Failed to retrieve data quality summary: ${errorMessage}` };
  }
}

export async function listCanonicalSectors(): Promise<
  | {
      sectors: string[];
    }
  | { error: string }
> {
  try {
    const deals = await fetchDealsSafely();
    const workOrders = await fetchWorkOrdersSafely();

    const sectors = new Set<string>();

    for (const d of deals) {
      if (d.sector) {
        sectors.add(d.sector);
      }
    }

    for (const w of workOrders) {
      if (w.sector) {
        sectors.add(w.sector);
      }
    }

    return {
      sectors: Array.from(sectors).sort(),
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.startsWith("monday.com data unavailable:")) {
      return { error: errorMessage };
    }
    return { error: `Failed to list canonical sectors: ${errorMessage}` };
  }
}

export interface SectorSummary {
  sector: string;
  count: number;
  value: number;
}

export interface FlagHighlight {
  flag: string;
  count: number;
}

export interface LeadershipUpdateResult {
  totalOpenPipelineValue: number;
  totalOpenDealCount: number;
  topSectorsByValue: SectorSummary[];
  totalRevenueCollected: number;
  totalReceivable: number;
  dataQualityHighlights: FlagHighlight[];
  caveats: string[];
}

export async function generateLeadershipUpdate(
  focusArea?: string
): Promise<LeadershipUpdateResult | { error: string }> {
  try {
    const rawDeals = await fetchDealsSafely();
    const rawWorkOrders = await fetchWorkOrdersSafely();
    const caveats: string[] = [];

    let deals = rawDeals.filter(d => d.dealStatus?.toLowerCase() === "open");
    let workOrders = rawWorkOrders;

    if (focusArea) {
      const targetSector = focusArea.trim().toLowerCase();
      deals = deals.filter(d => d.sector?.toLowerCase() === targetSector);
      workOrders = workOrders.filter(w => w.sector?.toLowerCase() === targetSector);
      caveats.push(`Leadership update is scoped specifically to the focus area sector: "${focusArea}".`);
    }

    // Calculations
    let totalOpenPipelineValue = 0;
    let excludedDealsValue = 0;
    const sectorAggs: Record<string, { count: number; value: number }> = {};
    const flagCounts: Record<string, number> = {};

    for (const d of deals) {
      if (d.dealValue === null) {
        excludedDealsValue++;
      } else {
        totalOpenPipelineValue += d.dealValue;
      }

      const sector = d.sector || "Unknown";
      if (!sectorAggs[sector]) {
        sectorAggs[sector] = { count: 0, value: 0 };
      }
      sectorAggs[sector].count++;
      if (d.dealValue !== null) {
        sectorAggs[sector].value += d.dealValue;
      }

      for (const flag of d.dataQualityFlags) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      }
    }

    if (excludedDealsValue > 0) {
      caveats.push(`Excluded ${excludedDealsValue} deals from pipeline value sum due to missing dealValue.`);
    }

    const topSectorsByValue: SectorSummary[] = Object.entries(sectorAggs)
      .map(([sector, agg]) => ({
        sector,
        count: agg.count,
        value: agg.value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // Revenue calculations
    let totalRevenueCollected = 0;
    let totalReceivable = 0;
    let excludedCollected = 0;
    let excludedReceivable = 0;

    for (const w of workOrders) {
      if (w.collectedAmountInclGst === null) {
        excludedCollected++;
      } else {
        totalRevenueCollected += w.collectedAmountInclGst;
      }

      if (w.amountReceivable === null) {
        excludedReceivable++;
      } else {
        totalReceivable += w.amountReceivable;
      }

      for (const flag of w.dataQualityFlags) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      }
    }

    if (excludedCollected > 0) {
      caveats.push(`Excluded ${excludedCollected} work orders from revenue collected sum due to missing collectedAmountInclGst.`);
    }
    if (excludedReceivable > 0) {
      caveats.push(`Excluded ${excludedReceivable} work orders from amount receivable sum due to missing amountReceivable.`);
    }

    const dataQualityHighlights: FlagHighlight[] = Object.entries(flagCounts)
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      totalOpenPipelineValue,
      totalOpenDealCount: deals.length,
      topSectorsByValue,
      totalRevenueCollected,
      totalReceivable,
      dataQualityHighlights,
      caveats,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.startsWith("monday.com data unavailable:")) {
      return { error: errorMessage };
    }
    return { error: `Failed to generate leadership update: ${errorMessage}` };
  }
}
