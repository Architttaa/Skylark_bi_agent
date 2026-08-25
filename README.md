# Skylark BI Agent

The Skylark BI Agent is a founder-facing business intelligence assistant designed to query and interpret live monday.com Deals and Work Orders board data. Built for Skylark Drones, the application allows management to ask natural language questions about sales pipeline health, collections metrics, and revenue summaries. The agent translates conversational prompts into structured GraphQL queries and extracts real-time metrics while maintaining rigorous data quality verification, acronym casing safety, and cross-board sector canonicalization.

---

## Architecture Overview

The system is designed as a Next.js monolith. Conversations are fed into a Gemini-driven function-calling agent (`gemini-3.6-flash`). Based on the prompt, the agent chooses to call one or more local BI functions that retrieve, filter, and aggregate normalized Monday data. Requests to monday.com are mapped via an in-memory cache-aside utility (5-minute TTL) to stay under API rate limits.

```text
[ User Browser ]
       │
       ▼ (REST / POST)
[ Next.js API Route (/api/chat) ]
       │
       ▼ (Context Orchestration)
[ Gemini 3.6 Agent ] ──(Calls)──► [ BI Tool Functions (lib/tools.ts) ]
       │                                     │
       ▼ (Response Generation)               ▼ (Cache Check)
[ Markdown Chat Stream ]          [ Cache-Aside / Normalizer ]
                                             │
                                             ▼ (GraphQL Query)
                                  [ Monday.com API v2 ]
```

---

## Getting Started

Follow these steps to run the application locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Architttaa/Skylark_bi_agent.git
   cd Skylark_bi_agent
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Copy the example environment file to a local file:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and configure your credentials:
   ```env
   MONDAY_API_TOKEN=your_monday_token_here
   MONDAY_DEALS_BOARD_ID=your_deals_board_id_here
   MONDAY_WORK_ORDERS_BOARD_ID=your_work_orders_board_id_here
   GEMINI_API_KEY=your_gemini_key_here
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to access the chat dashboard.

---

## Monday.com Configuration

To configure your monday.com boards, import your Deals and Work Orders CSVs as boards.

### 1. Retrieve the API Token
Go to **Admin > API** or **Profile > Developers** in your monday.com workspace to copy your personal API token.

### 2. Retrieve Board and Column IDs
Run the following GraphQL query inside the [Monday API Playground](https://api.monday.com/v2/developer/playground) to find the ID and column configuration of your imported boards:

```graphql
query GetBoardMetadata {
  boards(limit: 50) {
    id
    name
    columns {
      id
      title
      type
    }
  }
}
```

This query lists the exact column IDs (e.g. `color_mm6jaqn8`, `numeric_mm6jr1gg`) needed to configure the normalizing filters.

---

## Project Links

* **Hosted Deployment**: [https://skylark-bi-agent.vercel.app](https://skylark-bi-agent.vercel.app)
* **Architectural Decisions**: See [DECISION_LOG.md](file:///c:/Users/Archita%20Das/Desktop/skylark-bi-agent/DECISION_LOG.md) for details on caching, LLM integrations, and category isolation mappings.

---

## AI Tools Note
This project was built iteratively using **Claude** for initial architectural planning and system design, and **Antigravity/Gemini** as the in-IDE coding agent for implementation, validation, and deployment.
