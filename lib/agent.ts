import {
  GoogleGenerativeAI,
  FunctionDeclaration,
  SchemaType,
  Content,
  GenerativeModel,
  GenerateContentResult,
  Tool,
} from "@google/generative-ai";
import {
  getPipelineBySector,
  getRevenueSummary,
  getWorkOrderStatus,
  getDataQualitySummary,
  listCanonicalSectors,
} from "./tools";

const systemInstruction = `You are a founder-facing business intelligence assistant for Skylark Drones, operating over live monday.com Deals and Work Order data.

Follow these strict operating rules:
1. Sector Validation: If the user's query mentions a sector but you are unsure of the exact canonical name (or if it is not in the exact canonical form), you MUST call listCanonicalSectors first before querying other tools. Do not guess a sector name that might not exist.
2. Transparency & Quality flags: Always surface any caveats or dataQualityFlags returned by the tools in your final answer. Do not omit them or hide data gaps from the user.
3. Ambiguity handling: If a query is genuinely ambiguous (e.g., "this quarter" without specifying calendar vs. fiscal quarter, or "pipeline" without clarifying if Closed-Won or other non-open deals should be included), ask a clarifying question instead of guessing.
4. Accuracy: Never fabricate numbers, statistics, or calculations not returned by a tool call. Report exactly what the tool outputs.
5. Tone: Professional, direct, and founder-focused. Keep explanations clear, and highlight key metrics and potential data quality concerns.`;

const getPipelineBySectorDeclaration: FunctionDeclaration = {
  name: "getPipelineBySector",
  description:
    "Aggregates open deals filtered by an optional sector and/or calendar quarter (e.g. Q1-2026). Returns total count, value sum, stage breakdown, and sector breakdown.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      sector: {
        type: SchemaType.STRING,
        description:
          "The optional canonical sector name to filter by. Case-insensitive.",
      },
      quarter: {
        type: SchemaType.STRING,
        description:
          "The optional quarter to filter by, formatted as 'Q[1-4]-[YYYY]', e.g. 'Q1-2026'. Checks tentativeCloseDate.",
      },
    },
  },
};

const getRevenueSummaryDeclaration: FunctionDeclaration = {
  name: "getRevenueSummary",
  description:
    "Aggregates revenue metrics (billed value incl GST, collected amount incl GST, and amount receivable) from Work Orders, with an optional period filter.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      period: {
        type: SchemaType.STRING,
        description:
          "The optional billing period (e.g. month name or description) matching expected or actual billing months.",
      },
    },
  },
};

const getWorkOrderStatusDeclaration: FunctionDeclaration = {
  name: "getWorkOrderStatus",
  description:
    "Filters and returns Work Orders status by sector and/or case-insensitive partial status (e.g. 'completed'). Returns matched counts, names, statuses, and relevant amounts.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      sector: {
        type: SchemaType.STRING,
        description: "The optional canonical sector name to filter by.",
      },
      status: {
        type: SchemaType.STRING,
        description:
          "The optional execution status search term (case-insensitive, partial matching). E.g. 'completed' or 'executed'.",
      },
    },
  },
};

const getDataQualitySummaryDeclaration: FunctionDeclaration = {
  name: "getDataQualitySummary",
  description:
    "Aggregates and counts occurrences of all data quality flags across both the Deals and Work Orders boards.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

const listCanonicalSectorsDeclaration: FunctionDeclaration = {
  name: "listCanonicalSectors",
  description:
    "Retrieves the deduplicated sorted list of canonical sector names currently present in the dataset across both Deals and Work Orders boards.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

// Check if the error returned from Gemini is rate limit (429) or temporary service error (503)
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Check if it is a fetch error with status property
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (status === 429 || status === 503) {
      return true;
    }
  }

  // Fallback check on string representations of the error
  const errMsg = error instanceof Error ? error.message : String(error);
  const errMsgLower = errMsg.toLowerCase();

  return (
    errMsg.includes("429") ||
    errMsg.includes("503") ||
    errMsgLower.includes("resource_exhausted") ||
    errMsgLower.includes("service unavailable") ||
    errMsgLower.includes("too many requests") ||
    errMsgLower.includes("quota exceeded")
  );
}

// Executes a model generateContent call with a maximum of 2 retries (exponential backoff)
async function generateContentWithRetry(
  model: GenerativeModel,
  params: { contents: Content[]; tools: Tool[] }
): Promise<GenerateContentResult> {
  const maxRetries = 2;
  const backoffDelays = [1000, 2000]; // Delay in ms: 1s for first retry, 2s for second retry

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(params);
    } catch (error: unknown) {
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = backoffDelays[attempt];
        console.warn(
          `Gemini API call failed with retryable error. Retrying in ${delay}ms (Attempt ${
            attempt + 1
          }/${maxRetries})...`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Retry loop terminated unexpectedly.");
}

export async function runAgent(
  userMessage: string,
  conversationHistory: {
    role: "user" | "model";
    parts: { text: string }[];
  }[]
): Promise<{
  reply: string;
  toolCalls: { name: string; args: unknown }[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    systemInstruction,
  });

  // Map conversation history to Content format
  const contents: Content[] = conversationHistory.map((item) => ({
    role: item.role === "user" ? "user" : "model",
    parts: item.parts.map((p) => ({ text: p.text })),
  }));

  // Append user message
  contents.push({
    role: "user",
    parts: [{ text: userMessage }],
  });

  const tools = [
    {
      functionDeclarations: [
        getPipelineBySectorDeclaration,
        getRevenueSummaryDeclaration,
        getWorkOrderStatusDeclaration,
        getDataQualitySummaryDeclaration,
        listCanonicalSectorsDeclaration,
      ],
    },
  ];

  const result = await generateContentWithRetry(model, {
    contents,
    tools,
  });
  let response = result.response;
  const toolCallsLogged: { name: string; args: unknown }[] = [];

  // Multi-turn tool execution loop
  while (response.functionCalls() && response.functionCalls()!.length > 0) {
    const functionCalls = response.functionCalls()!;

    // Append the model's function call turn to history
    contents.push({
      role: "model",
      parts: response.candidates?.[0]?.content?.parts || [],
    });

    const functionResponseParts = [];

    for (const call of functionCalls) {
      const { name, args } = call;
      toolCallsLogged.push({ name, args });

      let functionResult: unknown;
      try {
        if (name === "getPipelineBySector") {
          const typedArgs = args as { sector?: string; quarter?: string };
          functionResult = await getPipelineBySector(
            typedArgs.sector,
            typedArgs.quarter
          );
        } else if (name === "getRevenueSummary") {
          const typedArgs = args as { period?: string };
          functionResult = await getRevenueSummary(typedArgs.period);
        } else if (name === "getWorkOrderStatus") {
          const typedArgs = args as { sector?: string; status?: string };
          functionResult = await getWorkOrderStatus(
            typedArgs.sector,
            typedArgs.status
          );
        } else if (name === "getDataQualitySummary") {
          functionResult = await getDataQualitySummary();
        } else if (name === "listCanonicalSectors") {
          functionResult = await listCanonicalSectors();
        } else {
          functionResult = { error: `Tool ${name} not found.` };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        functionResult = {
          error: `Failed to execute tool ${name}: ${msg}`,
        };
      }

      functionResponseParts.push({
        functionResponse: {
          name,
          response: functionResult as Record<string, unknown>,
        },
      });
    }

    // Append the function response with role: "user" (Gemini expects tool outputs under "user" role)
    contents.push({
      role: "user",
      parts: functionResponseParts,
    });

    const nextResult = await generateContentWithRetry(model, {
      contents,
      tools,
    });
    response = nextResult.response;
  }

  const reply = response.text() || "";
  return { reply, toolCalls: toolCallsLogged };
}
