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

All "Live" rows below were exercised in this environment against a **local Ollama**
(`qwen2.5:3b`, CPU-only, 4 cores) with selected journeys repeated on `qwen2.5:7b`. No hosted
provider key was available, so hosted providers are **Wired** (same code path, exercised only
through the provider abstraction's OpenAI-compatible mode against Ollama). Where the 3B model
was not capable enough, the row says so; the pipeline's deterministic guards are what keep a
weak model from producing wrong answers, and the 7B runs show the same code producing correct
ones.

| # | Feature | Status | Verification evidence (§4) | Remaining limitations | Required configuration |
|---|---|---|---|---|---|
| — | Model service (`lib/llm/config.ts`, `provider.ts`, `telemetry.ts`) | Live (Ollama) / Wired (OpenAI, Anthropic, any OpenAI-compatible) | V1 | No streaming; cost is $0 unless `GMT24_LLM_PRICE_IN/OUT` set | `GMT24_LLM_PROVIDER`, `GMT24_LLM_MODEL`, `GMT24_LLM_API_KEY` (or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), optional `GMT24_LLM_BASE_URL`, `GMT24_LLM_MODEL_REASONING`, `GMT24_LLM_MODEL_EXTRACTION`, `GMT24_LLM_TIMEOUT_MS` |
| — | Orchestrator + tool loop + grounding validator (`lib/llm/orchestrator.ts`, `lib/ai/tools.ts`, `/api/ai/chat`) | Live | V1, V2 | Numbers in answers must reconcile to tool evidence or are flagged `unsupported`; 3B model needs 1–2 retries on tool-call JSON | model |
| — | Persistence | Live (client: split localStorage keys, hydration-gated) / Wired (server: memory, file, KV adapters) | V3 | Server store defaults to memory; `file` used in this environment | `GMT24_STORE=memory|file|kv`, `GMT24_STORE_PATH`, KV URL |
| — | Telemetry and usage (`/api/ai/usage`, `/api/ai/status`) | Live | V1 | Ring buffer, not a metrics backend | — |
| 1 | App Trainer | Live via orchestrator (tools: catalog, screen/workflow status, navigate, guide) | V2 | Assisted completion limited to gateway actions with preview | model |
| 2 | Pillar Two Specialist | Live via orchestrator (tools: knowledge search with authority tiers/FY, calc, facts, feature pack) | V2 | Knowledge base is the approved local set; no external legal corpus connector | model |
| 3 | Feedback Collector | Live via orchestrator (tool: draft ticket; tickets persisted, dedupe) | V2 | Local ticket sink, no external tracker | model |
| 4 | Explain Any Number | Live (trace tool; validator enforces reconciliation to `AuditNode`) | V2 | Version-diff narrative is deterministic | model |
| 5 | X-Ray Interviewer — document reading | Live (`/api/ai/extract-facts`; `extract_facts` tool; reading panel on `/xray/confirm`) | V4 | On `qwen2.5:3b` facts+quotes are reliable (4/4–5/5 verified) but mapping facts to answer options is unreliable, so the guards leave questions open; on `qwen2.5:7b` all three questions mapped correctly. Use ≥7B or a hosted model for `GMT24_LLM_MODEL_REASONING` | model (reasoning-class for classification) |
| 6 | Calculation Reviewer | Deterministic checks (Live) + AI investigation via orchestrator | V2 | — | model |
| 7 | Strategy Simulator | Live (tool: run scenario through engine; unsupported levers reported) | V2 | Sensitivity narrative deterministic | model |
| 8 | Audit Rehearsal — answer evaluation | Live (`/api/ai/rehearsal/evaluate`; per-question exchange on `/rehearsal`, follow-ups chain, package export) | V5, V6 | 3B model sometimes answers Thai input in English and can misread the record; deterministic figure/contradiction guards drop those, 7B answered in Thai correctly | model |
| 9 | Regulatory Impact Watch | Live (`/api/regwatch/check`: fetch, normalise, hash, version store, new-doc and amended detection, LLM change summary; review → reassessment tasks) | V3 | OECD and BOI sites block automated readers (403 / Incapsula) — reported explicitly per source; RD pages work | model, optional `GMT24_REGWATCH_SOURCES` JSON, `GMT24_STORE=file|kv` to keep versions across restarts |
| 10 | CFO Briefing | Live (deterministic figures from the calc version; HTML presentation deck; memo with figure sources; follow-up Q&A via orchestrator) | V7 | Narrative prose is deterministic; the model answers follow-ups only | model for follow-ups |
| 11 | Quick Scan — company-name discovery | Live on the discovery/fetch hop (`/api/scan/discover`, `/api/scan/fetch`: web search → official IR/exchange page → PDF links → pdfjs text) / LLM structuring Wired for large reports | V8 | Exercised on Banpu Public Company Limited (real, outside the demo corpus) through discovery and text extraction; structuring a 200-page annual report exceeded what the CPU-only 3B model completes within timeouts — needs a hosted or GPU model. DuckDuckGo fallback is keyless and best-effort | `GMT24_SEARCH_PROVIDER=tavily|brave|serper`, `GMT24_SEARCH_API_KEY`; model |
| 11 | Quick Scan — upload | Live (pdfjs extraction → LLM structuring with page-verified quotes → same pipeline; provenance block) | V8 | Quote verification tolerates line-break noise; unverified quotes are shown, not hidden | model |

## 4. Verification log

Each entry names the environment, what was driven, and what was checked. "Headless" means a
puppeteer script against the running `next dev` server (scripts kept outside the repo).

**V1 — Model service and telemetry.** Ollama `qwen2.5:3b` via `GMT24_LLM_PROVIDER=ollama`.
`/api/ai/status` reports provider, model, reachability and store; `/api/ai/usage` accumulates
calls, tokens, latency and outcome (`answer`, `schema_reject`, `invalid_json`, `timeout`,
`error`) — every model call in this log appears there. Failure handling: unreachable model →
`503` with a user-facing message, timeouts → `504`, unconfigured → `501`; the UI keeps the
user's input in each case (see V6).

**V2 — Chat through the orchestrator.** English and Thai questions on the Co-Pilot panel
routed through `/api/ai/chat`: retrieval-first evidence (knowledge base + deterministic feature
pack), tool calls (`get_calculation`, `search_knowledge`, `feature_pack`, `run_scenario`,
`draft_ticket`), structured answer validated against the schema, numbers reconciled to tool
evidence; unreconciled figures listed under "unsupported" rather than shown as facts.
Rule-based fallback is labelled as such when the model is off.

**V3 — Regulatory Impact Watch (headless).** `POST /api/regwatch/check` fetched the configured
sources: Thai Revenue Department pages (reachable, Thai and English), OECD PDF and hub (403 —
surfaced as "publisher blocks automated readers" per source), BOI (Incapsula). A new RD
publication was detected as `new-doc`, summarised by the model (publication status downgraded
deterministically when the excerpt says draft/consultation), listed in the review queue,
approved with a decision note by a tax-manager role → reassessment task created for the
affected jurisdiction; approval, note and task survived a page reload (fixed a hydration-order
bug that had let an empty state overwrite localStorage). Re-running the check produced no
duplicate change.

**V4 — X-Ray Interviewer document reading.** Finding `XR-DIV-ADJ-TH-01` (excluded dividend,
TH-CE). Document: MY-CE dividend resolution + share register extract (2 pages).
*API, `qwen2.5:3b`* (five runs while tuning): facts extracted 2–5 per run, quotes verified
5/5, 3/3, 4/4; classification pass mapped questions inconsistently (`not-equity`, `third`,
`no`), so the added guards — deciding value must occur in the fact, both passes must agree —
left the ownership and payer questions open and kept only the withholding answer.
*API, `qwen2.5:7b`* (one run, 3 min): 4 facts, 4/4 verified, all three questions mapped
correctly — ownership ≥ 10% → `nonportfolio`, payer in the group register → `group`, single-tier
dividend → withholding `no`. *Headless UI, 3B*: attached `dividend.txt` on `/xray/confirm?f=…`,
progress ("Extracting text…", "Reading …") shown, result after 164 s: "relevant; 4 proposed
facts, 4/4 quotes verified", each with page and quote; 4 `source: document` facts persisted in
the registry as `proposed` with the finding's owner; "Link this document as" evidence actions
offered.

**V5 — Audit Rehearsal evaluation (API).** Question "How did you derive the Thailand GloBE ETR of
9.85%?" with record figures $6,120,000 / $62,150,000, recast 15%. Answer with rounded figures
("about 6.1 million", "62 million"), an invented 20% deferred rate and a claim the DTL schedule
was confirmed: 3B verdict `contradicts-record`; rounded figures accepted within 1.5 %; `20%`
flagged "not in the record"; contradiction 20% vs 15% shown; follow-up asked for the DTL
schedule. Thai follow-up round ("เรายังไม่มีตาราง… 15% … 62.15 ล้านดอลลาร์"): 7B answered in
Thai with correct agreements and no false contradiction and withheld a draft containing a stray
figure; 3B answered in English and once misquoted the record ("record states 20%") — dropped by
the guard that requires the record side of a contradiction to contain only record figures.

**V6 — Audit Rehearsal (headless UI).** First question (Ireland ETR 7.07%), answer typed with
"20% statutory rate" and "fully confirmed": progress shown, evaluated in 38 s, verdict tag
"Contradicts the record", contradiction row, unsupported list with "Create remediation task",
"auditor would now ask to see", figures note, follow-up question rendered; after reload the
round and "1 rehearsed" persisted; Evidence history has the "Rehearsal answer evaluated" row;
package download contains "Rehearsed exchange" and the evaluation. Failure paths with the request
intercepted: 503 → "The language model is not reachable right now — your answer is kept…", no
provider detail leaked, answer retained; hung request → progress, Cancel → "Evaluation
cancelled. Your answer is still in the box.", answer retained.

**V7 — CFO Briefing (headless UI).** `/briefing?audience=cfo`: decisions carry owners; the
confirmed-versus-estimates section renders; jurisdiction names link to `/etr?iso=…` traces.
"Slides" downloaded `briefing-cfo-FY2026-slides.html` (9 slides = cover + 7 sections + basis),
every slide stamped with `GMT24-CALC 2026.2 · FY2026 working · PROVISIONAL`; the file rendered
standalone, present mode and arrow-key navigation worked. "Memo" contains "Where each figure
comes from" with five `/etr?iso=` references. Headline figures equal the `/overview` totals for
the same calculation version.

**V8 — Quick Scan.** *Discovery hop (real company)*: "Banpu Public Company Limited" → DuckDuckGo
fallback (5 hits, no direct PDF) → second hop harvested PDF links from the official IR page →
`/api/scan/fetch` extracted text with pdfjs (custom parser replaced after it produced garbage on
InDesign PDFs). Structuring the full annual report with the CPU-only 3B model exceeded the
timeout; the outcome is reported to the user as an explicit failure with the discovered sources
listed, never substituted with a demo company. *Upload path*: PDF → pdfjs pages → LLM structured
extraction with per-quote verification → `ScanResult` with `discovery` provenance (provider,
model, verified/unverified quotes) now shown in the evidence panel; discovered source URLs are
live links, demo-corpus URLs stay disabled and labelled.

**Not exercised in this environment (needs configuration):** hosted providers (no key), a
search provider with an API key (only the keyless fallback ran), KV store, full company-name
scan through LLM structuring of a large report (needs a faster model than CPU 3B/7B).
