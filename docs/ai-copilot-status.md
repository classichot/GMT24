# GMT24 AI Co-Pilot — feature-status matrix

Snapshot of the implementation **before** the real-LLM work started (branch point `c1c9f35`),
followed by the delivery matrix that is updated as stages land. Every row states what is
actually running, not what the UI copy implies.

## 1. How a request flowed before this work

**Chat.** `components/Copilot.tsx` → `AiProvider.ask()` → `lib/ai/router.detectIntent()`
(regex over Thai/English text + current screen) → one of eleven deterministic feature modules
(`lib/ai/trainer.ts`, `specialist.ts`, `feedback.ts`, `explain.ts`, `interviewer.ts`,
`reviewer.ts`, `strategy.ts`, `rehearsal.ts`, `regwatch.ts`, `briefing.ts`, `quickscan.ts`)
→ a `Reply` (title, typed sections, cites, proposed actions, `grounded`, `unsupported`)
→ appended to a thread keyed by group/FY/screen → persisted in `localStorage["gmt24_ai_v1"]`.
Proposed actions execute through `lib/ai/actions.ts` (permission-gated gateway bound to the
store). **No model call exists anywhere in this path.** Language handling is keyword
matching; anything the regexes miss falls to `specialistReply`, which is template text.

**Quick Scan.** `/quickscan` page or chat → `AiProvider.runScan()` → `lib/scan/pipeline.buildScan()`
→ `lib/scan/corpus.ts` (two hand-written companies: Aetherion, ThaiCoal) → `jurisdictionDb.ts`
→ `ScanResult`. Company-name entry resolves **only** against the fixed corpus; an unknown
name returns "not found". Upload path: `/api/ai/extract` (real PDF/CSV text extraction, page
referenced, instruction lines stripped) → `lib/scan/extract.ts` (regex heuristics) → same
pipeline. No web discovery, no model, no source fetch.

## 2. Feature-status matrix (before)

| # | Feature | Frontend | Backend | Model calls | Data / retrieval | Actions | Mock / canned / placeholder | Missing |
|---|---|---|---|---|---|---|---|---|
| 1 | App Trainer | `/trainer`, menu guide, chat | none | none | `lib/ai/catalog.ts` (screen registry + playbooks) | navigate, guided steps | Regex intent; template sentences | Free-form understanding, error diagnosis from real logs, assisted completion preview |
| 2 | Pillar Two Specialist | chat | none | none | `lib/ai/knowledge.ts` — 30-odd KB entries, authority tiers, FY filter | navigate | Answer = KB passage + engine figures glued by template; `lib/copilot.ts` canned Q&A per seed | LLM synthesis, unfamiliar questions, missing-fact dialogue, memo drafting |
| 3 | Feedback Collector | `/feedback`, chat | none | none | tickets in localStorage | create-ticket | Regex ticket drafting; dedupe by token overlap | Conversational clarification, real ticket sink, aggregation |
| 4 | Explain Any Number | `Amount` audit trail, chat | none | none | engine `AuditNode` trace (real, deterministic) | open-audit, download note | Prose is template over the trace (acceptable: numbers come from trace) | Natural-language follow-ups, version diff narrative |
| 5 | X-Ray Interviewer | `/xray/confirm`, chat | `/api/ai/extract` | none | X-Ray findings (deterministic), attachments | answer-xray, attach, sign | Follow-ups are fixed per finding kind; "interprets narrative" = keyword match | Adaptive interview, proposed-fact extraction from documents |
| 6 | Calculation Reviewer | `/reviewer`, chat | none | none | `reviewCalculation()` deterministic checks (real) | task create/resolve/dismiss/reopen | none for checks; AI "investigation" absent | AI-assisted investigation narrative, evidence linking |
| 7 | Strategy Simulator | `/strategy`, chat | none | none | `parseScenario()` regex → engine run (real numbers) | save/adopt scenario (reviewable) | Regex NL parsing only; unsupported phrasing silently ignored | LLM scenario parsing with explicit assumptions, sensitivity narrative |
| 8 | Audit Rehearsal | `/rehearsal`, chat | none | none | `rehearse()` from calcs/findings (real) | create-task | Answer evaluation = keyword presence | Real answer evaluation, contradiction detection |
| 9 | Regulatory Impact Watch | `/regwatch` | `/api/oecd-central-record` (fetches live OECD page, parses) | none | pack amendments, central record | approve/reject reg | Only one source polled; summaries templated | Multi-source monitoring, version storage, AI change summary, routing |
| 10 | CFO Briefing | `/briefing`, chat | none | none | calcs, scenarios, tasks (real) | download memo | Prose templated | Narrative generation, follow-up Q&A on the briefing |
| 11 | Quick Scan | `/quickscan`, chat | `/api/ai/extract` | none | fixed corpus (2 companies), jurisdiction DB | onboard-scan | **Demo corpus stands in for discovery**; regex entity extraction | Company-name discovery, source fetch, LLM extraction with page cites |

Shared gaps: no model service, no provider config, no schema validation, no server-side
persistence, no cost/latency telemetry beyond a client-side estimate, no cancel/retry.

## 3. Delivery matrix (updated per stage)

Legend — **Live**: core journey runs against a real model in the running app and was
exercised. **Wired**: code path complete, needs the listed configuration to run live.
**Deterministic**: works today without a model (kept as the labelled fallback, never
presented as an AI answer). **Open**: not built.

| # | Feature | Status | Verification evidence | Remaining limitations | Required configuration |
|---|---|---|---|---|---|
| — | Model service (`lib/llm/*`, `/api/ai/chat`) | Live (local Ollama) / Wired (hosted) | See §4 | Streaming not implemented | `GMT24_LLM_PROVIDER`, `GMT24_LLM_MODEL`, `GMT24_LLM_API_KEY`, optional `GMT24_LLM_BASE_URL` |
| — | Tool layer + grounding validator | Live | §4 | Tools run in the client against the open group; server validates numbers against tool evidence | none |
| — | Persistence | Deterministic (client) + Wired (server work-record adapter) | — | Server store is in-memory unless a KV/Postgres adapter is configured | `GMT24_STORE_URL` (see `lib/server/store.ts`) |
| 1 | App Trainer | Live via orchestrator (tools: catalog, workflow status, navigate) | §4 | Assisted-completion preview limited to gateway actions | model |
| 2 | Pillar Two Specialist | Live via orchestrator (tools: knowledge search, calc, facts) | §4 | KB is the approved local set; no external legal corpus | model |
| 3 | Feedback Collector | Live via orchestrator (tool: draft ticket) | §4 | Ticket sink is local; no external tracker | model |
| 4 | Explain Any Number | Live (trace tool; validator enforces reconciliation) | §4 | — | model |
| 5 | X-Ray Interviewer | Live via orchestrator (tools: findings, attachments, propose fact) | §4 | Document fact extraction quality depends on model | model |
| 6 | Calculation Reviewer | Deterministic checks + Live narrative | §4 | — | model |
| 7 | Strategy Simulator | Live (tool: run scenario through engine) | §4 | Unsupported levers reported, not simulated | model |
| 8 | Audit Rehearsal | Live via orchestrator (tool: rehearsal set, evaluate answer) | §4 | — | model |
| 9 | Regulatory Impact Watch | Deterministic monitor (OECD central record) + Wired summary | — | Additional sources need connectors | model, `GMT24_REGWATCH_SOURCES` |
| 10 | CFO Briefing | Live (tool: briefing pack) | §4 | Presentation export is Markdown | model |
| 11 | Quick Scan — discovery | Wired (`/api/scan/discover`, `/api/scan/fetch`) | — | Needs a search provider key; DuckDuckGo HTML fallback is best-effort | `GMT24_SEARCH_PROVIDER`, `GMT24_SEARCH_API_KEY` |
| 11 | Quick Scan — upload | Live extraction + Wired LLM structuring | §4 | — | model |

## 4. Verification log

Filled in as journeys are exercised in the running app. Each entry names the model, the
question, the tools invoked, and what was checked.
