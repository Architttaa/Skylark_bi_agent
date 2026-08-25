# Decision Log - Skylark BI Agent

This document outlines the key technical, architectural, and business logic decisions made during the design and implementation of the Skylark BI Agent.

## 1. Data Normalization & Sector Canonicalization

### Acronym Preservation
* **Decision**: Known all-caps acronyms (e.g. `DSP`, `BFSI`, `IT`, `GIS`, `GPS`, `PO`, `LOI`, `BD`, `KAM`) are preserved as uppercase. Other sector values are title-cased.
* **Rationale**: Acronyms denote distinct technological frameworks or business divisions. Normalizing `DSP` to `Dsp` is syntactically incorrect and misleading for stakeholders.

### Category Isolation
* **Decision**: Did NOT merge `Renewables` or `Powerline` into `Energy/Power`. Did NOT merge `Construction` into `Infrastructure`.
* **Rationale**: Merging related but business-distinct sectors (e.g. EPC/Construction vs. infrastructure asset maintenance) loses fine-grained pipeline analysis required by management.

### Junk Value Invalidation
* **Decision**: Raw values like `"Sector/service"` (and case variants) are mapped to `sector: null` and flagged as `missing_sector`.
* **Rationale**: Monday.com board structures contained placeholder or default header rows. Treating them as canonical sectors introduces junk entries into pipeline analysis.

---

## 2. API Caching & Monday.com Fetching

### Caching Strategy
* **Decision**: Implemented an in-memory cache-aside utility with a 5-minute TTL.
* **Rationale**: The monday.com GraphQL API has rate limit thresholds. Caching the normalized boards prevents hitting limits during rapid conversational exchanges, while keeping data fresh.

### Cursor Pagination
* **Decision**: Queries use recursion to traverse cursor pagination (`next_items_page`).
* **Rationale**: Monday.com boards frequently exceed single-page limits (500 items). Restricting queries to a single page results in incomplete calculations.

---

## 3. Gemini LLM Integration

### Model Selection
* **Decision**: Configured `"gemini-3.6-flash"` as the target model.
* **Rationale**: Replaces `gemini-2.0-flash` which returned HTTP 404 (Not Available) from the Generative Language API.

### Custom Calling Loop
* **Decision**: Implemented a custom loop using `model.generateContent` directly, mapping tool responses to `role: "user"`.
* **Rationale**: The official SDK's `chat.sendMessage` maps tool responses internally to `role: "function"`. The modern Gemini 3.6 API rejects this role with HTTP 400 (Bad Request), requiring `role: "user"` or `role: "tool"` for GFM tool blocks.

### Transient Retry Mechanism
* **Decision**: Implemented exponential backoff retries (maximum of 2 attempts) for HTTP `429` and `503` errors.
* **Rationale**: Adds resilience against AI provider capacity limits and connection drops.

---

## 4. UI Design

### Empty-State Prompting
* **Decision**: Designed a monospace console prompt dashboard with 5 real-world, grounded question cards.
* **Rationale**: Helps founders understand exactly what metrics are queryable, and triggers immediate conversational execution.
