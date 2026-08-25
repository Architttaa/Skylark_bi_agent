# Architectural Decision Log: Skylark BI Agent

This document chronicles the core engineering assumptions, architectural trade-offs, data resilience strategies, and scope decisions made during the design and implementation of the Skylark BI Agent.

## 1. Key Assumptions

At the project’s inception, we established that monday.com would serve as the sole, authoritative system of record. Because all operational data lives on Monday, we assumed no local database or persistence layer was required. However, relying on live board data exposed two major challenges: semantic ambiguity in query boundaries and messy data entries.

First, we assumed that terms like "this quarter" or "sales pipeline" are semantically ambiguous. In corporate finance, "this quarter" could mean either the current calendar quarter or a company-specific fiscal quarter, and "pipeline" can either mean the active open deals or include historical closed-won contracts. Instead of silently applying default filters (which could mislead founders with skewed metrics), we designed the agent to explicitly stop and ask clarifying questions.

Second, we assumed that the messy sector entries present on the Deals board—namely the placeholder `"Sector/service"` value, and distinct sectors like `Renewables`, `Powerline`, `Construction`, and acronyms like `DSP`—needed manual review and rule-based normalization rather than automated, fuzzy category merging. Automated category clustering would have wrongly grouped `Powerline` and `Renewables` under a generic "Energy" bucket. Preserving these as distinct service lines maintains the granularity necessary for leadership updates.

## 2. Architecture Trade-offs

We evaluated two architectural approaches: a split backend-frontend setup (such as a FastAPI backend with a Next.js frontend) and a unified Next.js serverless monolith deployed on Vercel. We chose the Next.js serverless monolith because monday.com is our sole data source and we lack a local persistence or complex redaction layer. This monolith design minimizes maintenance overhead, simplifies the build pipeline, and is optimized for Vercel's free-tier hosting limits, avoiding the premature separation of concerns.

To connect the model to Monday, we chose a direct GraphQL integration over a separate Model Context Protocol (MCP) server. A direct integration reduces hosting complexity by removing the need for a secondary middleware service, keeping the infrastructure lightweight. To mitigate Monday’s API rate limits and avoid request latency on every turn, we introduced an in-memory cache-aside layer with a 5-minute Time-To-Live (TTL).

For the reasoning engine, we utilized the Google AI Studio free tier for model execution. During the implementation phase, we discovered that the initially planned `gemini-2.0-flash` model had been deprecated and shut down (as of June 2026). We migrated the codebase to the active `"gemini-3.6-flash"` model, wrapping all calls in a custom `generateContent` execution loop to handle the API’s updated role requirements.

## 3. Data Resilience

To handle source data anomalies, we implemented a dedicated normalization layer that parses raw values and appends a `dataQualityFlags` list to each record. Rather than accepting the outputs of an automated first pass, our manual QA identified three data-quality issues:
- Silently-merged sector buckets (`Renewables` and `Construction` being grouped under wider categories).
- A literal junk value (`Sector/service`) inside the raw sector column, which we mapped to a `missing_sector` flag.
- A discrepancies audit where the clean Work Orders list returned 176 records while the monday.com UI reported 177 active data rows. By comparing the raw API payload count directly to our normalized count, we confirmed that both were exactly 176. The 177 count on Monday was traced to an import caching artifact in Monday's UI grid, proving the discrepancy was not a normalization bug.

## 4. Leadership Updates

We interpreted the "leadership update" request as an on-demand, text-based executive summary tailored for founders. The generated updates summarize overall pipeline value, open deal counts, revenue collected, receivables, sectoral concentration risks, and explicit data quality warnings. We deliberately descoped slideshow generation and presentation rendering given the project's tight timeline, prioritizing direct, high-value metrics over visual layout generation.

## 5. Future Optimizations

If given more development time, we would implement the following enhancements:
- **Persistence**: Save leadership-update history to a local database for trend analysis.
- **Regression Testing**: Add automated evaluations to test the model's tool selection accuracy against a test suite of founder questions.
- **Exports**: Build a PowerPoint/PDF export feature for generated leadership summaries.
- **Rate-Limit Handling**: Tune the exponential backoff to handle sustained quota exhaustion rather than just transient 503 errors.
