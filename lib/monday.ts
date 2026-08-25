import { getCached } from './cache';

export interface MondayColumnValue {
  id: string;
  text: string;
  value: string | null;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

interface MondayGraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

interface InitialQueryResponse {
  boards: {
    items_page: {
      cursor: string | null;
      items: MondayItem[];
    };
  }[];
}

interface NextPageQueryResponse {
  next_items_page: {
    cursor: string | null;
    items: MondayItem[];
  };
}

async function queryMonday<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new Error("MONDAY_API_TOKEN is not defined in environment variables.");
  }

  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
      "API-Version": "2026-07",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Monday API HTTP error ${response.status}: ${errorText}`);
  }

  const result = (await response.json()) as MondayGraphQLResponse<T>;
  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Monday API GraphQL error: ${result.errors.map((e) => e.message).join(", ")}`
    );
  }

  if (!result.data) {
    throw new Error("Monday API returned no data");
  }

  return result.data;
}

export async function fetchBoardItems(boardId: string): Promise<MondayItem[]> {
  const items: MondayItem[] = [];

  // Initial page query
  const initialQuery = `
    query GetBoardItems($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `;

  const initialData = await queryMonday<InitialQueryResponse>(initialQuery, {
    boardId: [boardId],
  });
  const board = initialData.boards?.[0];
  if (!board) {
    throw new Error(`Board with ID ${boardId} not found.`);
  }

  const itemsPage = board.items_page;
  items.push(...itemsPage.items);

  let cursor = itemsPage.cursor;

  // Paginate if cursor exists
  const nextPageQuery = `
    query GetNextItemsPage($cursor: String!) {
      next_items_page(limit: 500, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values {
            id
            text
            value
          }
        }
      }
    }
  `;

  while (cursor) {
    const nextData = await queryMonday<NextPageQueryResponse>(nextPageQuery, {
      cursor,
    });
    const nextPage = nextData.next_items_page;
    items.push(...nextPage.items);
    cursor = nextPage.cursor;
  }

  return items;
}

export async function getDealsRaw(): Promise<MondayItem[]> {
  const boardId = process.env.MONDAY_DEALS_BOARD_ID;
  if (!boardId) {
    throw new Error(
      "MONDAY_DEALS_BOARD_ID is not defined in environment variables."
    );
  }
  const ttlMs = 5 * 60 * 1000; // 5 minutes
  return getCached(`deals_${boardId}`, ttlMs, () => fetchBoardItems(boardId));
}

export async function getWorkOrdersRaw(): Promise<MondayItem[]> {
  const boardId = process.env.MONDAY_WORK_ORDERS_BOARD_ID;
  if (!boardId) {
    throw new Error(
      "MONDAY_WORK_ORDERS_BOARD_ID is not defined in environment variables."
    );
  }
  const ttlMs = 5 * 60 * 1000; // 5 minutes
  return getCached(`work_orders_${boardId}`, ttlMs, () => fetchBoardItems(boardId));
}
