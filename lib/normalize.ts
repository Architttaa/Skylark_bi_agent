import { getDealsRaw, getWorkOrdersRaw, MondayItem } from './monday';

export interface NormalizedDeal {
  id: string;
  name: string;
  ownerCode: string | null;
  clientCode: string | null;
  dealStatus: string | null;
  closeDateA: string | null;
  closureProbability: string | null;
  dealValue: number | null;
  tentativeCloseDate: string | null;
  dealStage: string | null;
  productDeal: string | null;
  sector: string | null;
  sectorRaw: string | null;
  createdDate: string | null;
  dataQualityFlags: string[];
}

export interface NormalizedWorkOrder {
  id: string;
  name: string;
  customerNameCode: string | null;
  serialNumber: string | null;
  natureOfWork: string | null;
  lastExecutedMonth: string | null;
  executionStatus: string | null;
  dataDeliveryDate: string | null;
  poLoiDate: string | null;
  documentType: string | null;
  probableStartDate: string | null;
  probableEndDate: string | null;
  bdKamCode: string | null;
  sector: string | null;
  sectorRaw: string | null;
  typeOfWork: string | null;
  skylarkPlatformInvolved: string | null;
  lastInvoiceDate: string | null;
  latestInvoiceNo: string | null;
  amountExclGst: number | null;
  amountInclGst: number | null;
  billedValueExclGst: number | null;
  billedValueInclGst: number | null;
  collectedAmountInclGst: number | null;
  amountToBeBilledExclGst: number | null;
  amountToBeBilledInclGst: number | null;
  amountReceivable: number | null;
  arPriorityAccount: string | null;
  quantityByOps: number | null;
  quantitiesAsPerPo: string | null;
  quantityBilled: number | null;
  balanceQuantity: number | null;
  invoiceStatus: string | null;
  expectedBillingMonth: string | null;
  actualBillingMonth: string | null;
  actualCollectionMonth: string | null;
  woStatusBilled: string | null;
  collectionStatus: string | null;
  collectionDate: string | null;
  billingStatus: string | null;
  dataQualityFlags: string[];
}

function getColumnText(item: MondayItem, columnId: string): string | null {
  const val = item.column_values.find((cv) => cv.id === columnId);
  if (!val) return null;
  const txt = val.text ? val.text.trim() : "";
  return txt === "" ? null : txt;
}

function parseToISO(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;

  // Try standard parse first
  const timestamp = Date.parse(trimmed);
  if (!isNaN(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY
  const dmYRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const match = trimmed.match(dmYRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  }

  return null;
}

function parseToNumber(text: string | null): number | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/,/g, "");
  if (trimmed === "") return null;

  const num = Number(trimmed);
  if (isNaN(num)) {
    return null;
  }
  return num;
}

const ACRONYMS = new Set(["DSP", "BFSI", "IT", "GIS", "GPS", "PO", "LOI", "BD", "KAM"]);

function canonicalizeSector(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");

  // 1. Strict mappings for actual values present in raw data
  if (normalized === "mining") {
    return "Mining";
  }
  if (
    normalized === "powerline" ||
    normalized === "power line" ||
    normalized === "power-line"
  ) {
    return "Powerline";
  }
  if (normalized === "tender") {
    return "Tender";
  }
  if (normalized === "renewables" || normalized === "renewable") {
    return "Renewables";
  }
  if (normalized === "dsp") {
    return "DSP";
  }
  if (normalized === "railways" || normalized === "railway") {
    return "Railways";
  }
  if (normalized === "construction") {
    return "Construction";
  }
  if (
    normalized === "security and surveillance" ||
    normalized === "security & surveillance"
  ) {
    return "Security and Surveillance";
  }
  if (normalized === "sector/service" || normalized === "sector / service") {
    return null;
  }
  if (normalized === "others" || normalized === "other") {
    return "Others";
  }
  if (normalized === "aviation") {
    return "Aviation";
  }
  if (normalized === "manufacturing") {
    return "Manufacturing";
  }

  // 2. Strict mappings for other standard sectors (avoiding generic merging)
  if (
    normalized === "telecom" ||
    normalized === "telecommunications" ||
    normalized === "telecommunication" ||
    normalized === "telco"
  ) {
    return "Telecom";
  }
  if (normalized === "software" || normalized === "softwares") {
    return "Software";
  }
  if (
    normalized === "it" ||
    normalized === "information technology" ||
    normalized === "information tech"
  ) {
    return "IT";
  }
  if (normalized === "saas") {
    return "SaaS";
  }
  if (normalized === "platform" || normalized === "platforms") {
    return "Platform";
  }
  if (normalized === "agri" || normalized === "agriculture") {
    return "Agriculture";
  }
  if (normalized === "energy") {
    return "Energy";
  }
  if (normalized === "power") {
    return "Power";
  }
  if (normalized === "infra" || normalized === "infrastructure") {
    return "Infrastructure";
  }
  if (normalized === "bfsi") {
    return "BFSI";
  }
  if (normalized === "banking") {
    return "Banking";
  }
  if (normalized === "finance" || normalized === "financial") {
    return "Finance";
  }
  if (normalized === "insurance") {
    return "Insurance";
  }
  if (normalized === "healthcare" || normalized === "health") {
    return "Healthcare";
  }
  if (normalized === "pharma" || normalized === "pharmaceuticals") {
    return "Pharma";
  }
  if (normalized === "medical") {
    return "Medical";
  }
  if (normalized === "consulting" || normalized === "consultancy") {
    return "Consulting";
  }
  if (normalized === "advisory") {
    return "Advisory";
  }
  if (normalized === "education" || normalized === "edu") {
    return "Education";
  }
  if (normalized === "school" || normalized === "schools") {
    return "School";
  }
  if (normalized === "training") {
    return "Training";
  }

  // 3. Fallback: Title Case for normal words, preserving all-caps known acronyms
  return trimmed
    .split(/\s+/)
    .map((w) => {
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) {
        return upper;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function normalizeDeal(item: MondayItem): NormalizedDeal {
  const flags: string[] = [];

  const ownerCode = getColumnText(item, "color_mm6jaqn8");
  if (!ownerCode) flags.push("missing_owner_code");

  const clientCode = getColumnText(item, "dropdown_mm6j3342");
  if (!clientCode) flags.push("missing_client_code");

  const dealStatus = getColumnText(item, "color_mm6jq89j");
  if (!dealStatus) flags.push("missing_deal_status");

  const closeDateAText = getColumnText(item, "date_mm6jyc8v");
  let closeDateA: string | null = null;
  if (closeDateAText) {
    closeDateA = parseToISO(closeDateAText);
    if (!closeDateA) flags.push("invalid_close_date_a");
  } else {
    flags.push("missing_close_date_a");
  }

  const closureProbability = getColumnText(item, "color_mm6jsc4q");
  if (!closureProbability) flags.push("missing_closure_probability");

  const dealValueText = getColumnText(item, "numeric_mm6j7z2w");
  let dealValue: number | null = null;
  if (dealValueText) {
    dealValue = parseToNumber(dealValueText);
    if (dealValue === null) flags.push("invalid_deal_value");
  } else {
    flags.push("missing_deal_value");
  }

  const tentativeCloseDateText = getColumnText(item, "date_mm6jzcea");
  let tentativeCloseDate: string | null = null;
  if (tentativeCloseDateText) {
    tentativeCloseDate = parseToISO(tentativeCloseDateText);
    if (!tentativeCloseDate) flags.push("invalid_tentative_close_date");
  } else {
    flags.push("missing_tentative_close_date");
  }

  const dealStage = getColumnText(item, "color_mm6jw7mn");
  if (!dealStage) flags.push("missing_deal_stage");

  const productDeal = getColumnText(item, "color_mm6jxakd");
  if (!productDeal) flags.push("missing_product_deal");

  const sectorText = getColumnText(item, "color_mm6jzhtw");
  let sector: string | null = null;
  let sectorRaw: string | null = null;
  if (sectorText) {
    sectorRaw = sectorText;
    sector = canonicalizeSector(sectorText);
    if (!sector) {
      flags.push("missing_sector");
    }
  } else {
    flags.push("missing_sector");
  }

  const createdDateText = getColumnText(item, "date_mm6jkkak");
  let createdDate: string | null = null;
  if (createdDateText) {
    createdDate = parseToISO(createdDateText);
    if (!createdDate) flags.push("invalid_created_date");
  } else {
    flags.push("missing_created_date");
  }

  return {
    id: item.id,
    name: item.name,
    ownerCode,
    clientCode,
    dealStatus,
    closeDateA,
    closureProbability,
    dealValue,
    tentativeCloseDate,
    dealStage,
    productDeal,
    sector,
    sectorRaw,
    createdDate,
    dataQualityFlags: flags,
  };
}

export function normalizeWorkOrder(item: MondayItem): NormalizedWorkOrder {
  const flags: string[] = [];

  const customerNameCode = getColumnText(item, "dropdown_mm6jd6y5");
  if (!customerNameCode) flags.push("missing_customer_name_code");

  const serialNumber = getColumnText(item, "dropdown_mm6jsbb8");
  if (!serialNumber) flags.push("missing_serial_number");

  const natureOfWork = getColumnText(item, "color_mm6jj5g9");
  if (!natureOfWork) flags.push("missing_nature_of_work");

  const lastExecutedMonth = getColumnText(item, "color_mm6j5r53");
  if (!lastExecutedMonth) flags.push("missing_last_executed_month");

  const executionStatus = getColumnText(item, "color_mm6jdakv");
  if (!executionStatus) flags.push("missing_execution_status");

  const dataDeliveryDateText = getColumnText(item, "date_mm6jkjhe");
  let dataDeliveryDate: string | null = null;
  if (dataDeliveryDateText) {
    dataDeliveryDate = parseToISO(dataDeliveryDateText);
    if (!dataDeliveryDate) flags.push("invalid_data_delivery_date");
  } else {
    flags.push("missing_data_delivery_date");
  }

  const poLoiDateText = getColumnText(item, "date_mm6jqqpx");
  let poLoiDate: string | null = null;
  if (poLoiDateText) {
    poLoiDate = parseToISO(poLoiDateText);
    if (!poLoiDate) flags.push("invalid_po_loi_date");
  } else {
    flags.push("missing_po_loi_date");
  }

  const documentType = getColumnText(item, "color_mm6jj851");
  if (!documentType) flags.push("missing_document_type");

  const probableStartDateText = getColumnText(item, "date_mm6jn0z8");
  let probableStartDate: string | null = null;
  if (probableStartDateText) {
    probableStartDate = parseToISO(probableStartDateText);
    if (!probableStartDate) flags.push("invalid_probable_start_date");
  } else {
    flags.push("missing_probable_start_date");
  }

  const probableEndDateText = getColumnText(item, "date_mm6jc0sa");
  let probableEndDate: string | null = null;
  if (probableEndDateText) {
    probableEndDate = parseToISO(probableEndDateText);
    if (!probableEndDate) flags.push("invalid_probable_end_date");
  } else {
    flags.push("missing_probable_end_date");
  }

  const bdKamCode = getColumnText(item, "color_mm6jnj9t");
  if (!bdKamCode) flags.push("missing_bd_kam_code");

  const sectorText = getColumnText(item, "color_mm6jax6v");
  let sector: string | null = null;
  let sectorRaw: string | null = null;
  if (sectorText) {
    sectorRaw = sectorText;
    sector = canonicalizeSector(sectorText);
    if (!sector) {
      flags.push("missing_sector");
    }
  } else {
    flags.push("missing_sector");
  }

  const typeOfWork = getColumnText(item, "color_mm6j4sws");
  if (!typeOfWork) flags.push("missing_type_of_work");

  const skylarkPlatformInvolved = getColumnText(item, "color_mm6j1964");
  if (!skylarkPlatformInvolved) flags.push("missing_skylark_platform_involved");

  const lastInvoiceDateText = getColumnText(item, "date_mm6jq88");
  let lastInvoiceDate: string | null = null;
  if (lastInvoiceDateText) {
    lastInvoiceDate = parseToISO(lastInvoiceDateText);
    if (!lastInvoiceDate) flags.push("invalid_last_invoice_date");
  } else {
    flags.push("missing_last_invoice_date");
  }

  const latestInvoiceNo = getColumnText(item, "dropdown_mm6jsz3r");
  if (!latestInvoiceNo) flags.push("missing_latest_invoice_no");

  const amountExclGstText = getColumnText(item, "numeric_mm6j2x2m");
  let amountExclGst: number | null = null;
  if (amountExclGstText) {
    amountExclGst = parseToNumber(amountExclGstText);
    if (amountExclGst === null) flags.push("invalid_amount_excl_gst");
  } else {
    flags.push("missing_amount_excl_gst");
  }

  const amountInclGstText = getColumnText(item, "numeric_mm6j9wnh");
  let amountInclGst: number | null = null;
  if (amountInclGstText) {
    amountInclGst = parseToNumber(amountInclGstText);
    if (amountInclGst === null) flags.push("invalid_amount_incl_gst");
  } else {
    flags.push("missing_amount_incl_gst");
  }

  const billedValueExclGstText = getColumnText(item, "numeric_mm6jykav");
  let billedValueExclGst: number | null = null;
  if (billedValueExclGstText) {
    billedValueExclGst = parseToNumber(billedValueExclGstText);
    if (billedValueExclGst === null)
      flags.push("invalid_billed_value_excl_gst");
  } else {
    flags.push("missing_billed_value_excl_gst");
  }

  const billedValueInclGstText = getColumnText(item, "numeric_mm6j7yv8");
  let billedValueInclGst: number | null = null;
  if (billedValueInclGstText) {
    billedValueInclGst = parseToNumber(billedValueInclGstText);
    if (billedValueInclGst === null)
      flags.push("invalid_billed_value_incl_gst");
  } else {
    flags.push("missing_billed_value_incl_gst");
  }

  const collectedAmountInclGstText = getColumnText(item, "numeric_mm6j272r");
  let collectedAmountInclGst: number | null = null;
  if (collectedAmountInclGstText) {
    collectedAmountInclGst = parseToNumber(collectedAmountInclGstText);
    if (collectedAmountInclGst === null)
      flags.push("invalid_collected_amount_incl_gst");
  } else {
    flags.push("missing_collected_amount_incl_gst");
  }

  const amountToBeBilledExclGstText = getColumnText(item, "numeric_mm6jr1gg");
  let amountToBeBilledExclGst: number | null = null;
  if (amountToBeBilledExclGstText) {
    amountToBeBilledExclGst = parseToNumber(amountToBeBilledExclGstText);
    if (amountToBeBilledExclGst === null)
      flags.push("invalid_amount_to_be_billed_excl_gst");
  } else {
    flags.push("missing_amount_to_be_billed_excl_gst");
  }

  const amountToBeBilledInclGstText = getColumnText(item, "numeric_mm6j2b0n");
  let amountToBeBilledInclGst: number | null = null;
  if (amountToBeBilledInclGstText) {
    amountToBeBilledInclGst = parseToNumber(amountToBeBilledInclGstText);
    if (amountToBeBilledInclGst === null)
      flags.push("invalid_amount_to_be_billed_incl_gst");
  } else {
    flags.push("missing_amount_to_be_billed_incl_gst");
  }

  const amountReceivableText = getColumnText(item, "numeric_mm6jfnd2");
  let amountReceivable: number | null = null;
  if (amountReceivableText) {
    amountReceivable = parseToNumber(amountReceivableText);
    if (amountReceivable === null) flags.push("invalid_amount_receivable");
  } else {
    flags.push("missing_amount_receivable");
  }

  const arPriorityAccount = getColumnText(item, "color_mm6jrbat");
  if (!arPriorityAccount) flags.push("missing_ar_priority_account");

  const quantityByOpsText = getColumnText(item, "numeric_mm6j35v");
  let quantityByOps: number | null = null;
  if (quantityByOpsText) {
    quantityByOps = parseToNumber(quantityByOpsText);
    if (quantityByOps === null) flags.push("invalid_quantity_by_ops");
  } else {
    flags.push("missing_quantity_by_ops");
  }

  const quantitiesAsPerPo = getColumnText(item, "dropdown_mm6j9bbz");
  if (!quantitiesAsPerPo) flags.push("missing_quantities_as_per_po");

  const quantityBilledText = getColumnText(item, "numeric_mm6jsfza");
  let quantityBilled: number | null = null;
  if (quantityBilledText) {
    quantityBilled = parseToNumber(quantityBilledText);
    if (quantityBilled === null) flags.push("invalid_quantity_billed");
  } else {
    flags.push("missing_quantity_billed");
  }

  const balanceQuantityText = getColumnText(item, "numeric_mm6j3hy4");
  let balanceQuantity: number | null = null;
  if (balanceQuantityText) {
    balanceQuantity = parseToNumber(balanceQuantityText);
    if (balanceQuantity === null) flags.push("invalid_balance_quantity");
  } else {
    flags.push("missing_balance_quantity");
  }

  const invoiceStatus = getColumnText(item, "color_mm6j63av");
  if (!invoiceStatus) flags.push("missing_invoice_status");

  const expectedBillingMonth = getColumnText(item, "text_mm6jhvr8");
  if (!expectedBillingMonth) flags.push("missing_expected_billing_month");

  const actualBillingMonth = getColumnText(item, "color_mm6ja8jy");
  if (!actualBillingMonth) flags.push("missing_actual_billing_month");

  const actualCollectionMonth = getColumnText(item, "text_mm6jpn0p");
  if (!actualCollectionMonth) flags.push("missing_actual_collection_month");

  const woStatusBilled = getColumnText(item, "color_mm6j1mb8");
  if (!woStatusBilled) flags.push("missing_wo_status_billed");

  const collectionStatus = getColumnText(item, "text_mm6jm3dd");
  if (!collectionStatus) flags.push("missing_collection_status");

  const collectionDateText = getColumnText(item, "text_mm6jvfgm");
  let collectionDate: string | null = null;
  if (collectionDateText) {
    const parsedIso = parseToISO(collectionDateText);
    if (parsedIso) {
      collectionDate = parsedIso;
    } else {
      collectionDate = collectionDateText; // fall back to raw text
      flags.push("invalid_collection_date");
    }
  } else {
    flags.push("missing_collection_date");
  }

  const billingStatus = getColumnText(item, "color_mm6j7ceg");
  if (!billingStatus) flags.push("missing_billing_status");

  return {
    id: item.id,
    name: item.name,
    customerNameCode,
    serialNumber,
    natureOfWork,
    lastExecutedMonth,
    executionStatus,
    dataDeliveryDate,
    poLoiDate,
    documentType,
    probableStartDate,
    probableEndDate,
    bdKamCode,
    sector,
    sectorRaw,
    typeOfWork,
    skylarkPlatformInvolved,
    lastInvoiceDate,
    latestInvoiceNo,
    amountExclGst,
    amountInclGst,
    billedValueExclGst,
    billedValueInclGst,
    collectedAmountInclGst,
    amountToBeBilledExclGst,
    amountToBeBilledInclGst,
    amountReceivable,
    arPriorityAccount,
    quantityByOps,
    quantitiesAsPerPo,
    quantityBilled,
    balanceQuantity,
    invoiceStatus,
    expectedBillingMonth,
    actualBillingMonth,
    actualCollectionMonth,
    woStatusBilled,
    collectionStatus,
    collectionDate,
    billingStatus,
    dataQualityFlags: flags,
  };
}

export async function getCleanDeals(): Promise<NormalizedDeal[]> {
  const rawDeals = await getDealsRaw();
  return rawDeals.map(normalizeDeal);
}

export async function getCleanWorkOrders(): Promise<NormalizedWorkOrder[]> {
  const rawWos = await getWorkOrdersRaw();
  return rawWos.map(normalizeWorkOrder);
}
