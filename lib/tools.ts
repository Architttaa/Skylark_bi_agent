import { getCleanDeals, getCleanWorkOrders } from "./normalize";

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
    const deals = await getCleanDeals();
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
    const workOrders = await getCleanWorkOrders();
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
    const workOrders = await getCleanWorkOrders();
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
    const deals = await getCleanDeals();
    const workOrders = await getCleanWorkOrders();

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
    const deals = await getCleanDeals();
    const workOrders = await getCleanWorkOrders();

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
    return { error: `Failed to list canonical sectors: ${errorMessage}` };
  }
}
