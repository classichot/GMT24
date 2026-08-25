# OECD Pillar 2 (GloBE) coverage — GMT24

**Snapshot:** GMT24-CALC 2026.2 · Aetherion seed group  
**Legal sources:** OECD GloBE Model Rules (2021); Consolidated Commentary to the GloBE Model Rules; Agreed Administrative Guidance where cited in code  
**Honesty rule:** Status is *implemented* only where the engine posts a number **and** a test (or an equivalent scripted assertion) proves it. UI copy, election-register labels, and teaching seeds without scenario tests are *partial*, *election-only*, or *method text*.

Statuses: **implemented** · **partial** · **missing** · **election-only** · **method text**

---

## 1. Art. 3.3 International Shipping Income (deep-dive)

### Auditor scorecard

| ID | Finding | Disposition |
| --- | --- | --- |
| B1 | Art. 3.3.6 OR management | **CLEARED** |
| B3 | Inland haulage not QAISI (¶171) | **CLEARED** |
| M1 | Art. 3.3.1 mandatory; no `OECD_3.3` election | **CLEARED** |
| B2 | Third-party bareboat tag split only | **CLEARED (second-read)** — lessee-ISI (3.3.2(d) ¶157) + ≤3-year duration engine incl. renewals (3.3.3(a) ¶164); failing tests when facts absent |
| M2 | Two-CE Art. 3.3.4 jurisdictional cap | **CLEARED** — tested |
| M3 | OECD Examples 3.3.1-1 / -2 / -3 | **CLEARED** — numeric tests |
| M4 | Art. 4.1.3(a) Covered Tax split | **CLEARED** — Example 4.1.3-1 proportional method; tax on 3.3.4 spill stays in |
| M5 | Traffic / voyage tests | **CLEARED** — ¶152 solely-domestic; ¶160 inland waterways |
| M7 | Art. 3.3.2(c) crewed time/voyage charter | **CLEARED** — category + expected-international-traffic gate |

No finding discarded without citation.

### Current status

| Topic | OECD | Status | Where | What tests prove |
| --- | --- | --- | --- | --- |
| Mandatory exclusion | Art. 3.3.1 | **implemented** | `computeShippingExclusion` | Examples 3.3.1-1 / -3; no election gate |
| Transport in international traffic | Art. 3.3.2(a) · ¶152 | **implemented** | `voyage.solelyDomesticPlaces` | Fail when solely domestic |
| Slot charter | Art. 3.3.2(b) | **implemented** | `slot_charter` + voyage screen | Domestic-only slot fails |
| Crewed time/voyage charter-out | Art. 3.3.2(c) · ¶156 | **implemented** | `time_voyage_charter` | Requires `expectedInternationalTraffic`; fails if absent |
| Intragroup bareboat | Art. 3.3.2(d) · ¶157 | **implemented** | `bareboat` facts | Needs `lesseeIsGroupCe` **and** `lesseeHasInternationalShippingIncome` |
| Ship sale | Art. 3.3.2(f) · ¶159 | **partial** | `heldYears ≥ 1` | Holding years are a fact, not a PPE/inventory classifier |
| Inland waterways same jur. | Art. 3.3.2 last · ¶160 | **implemented** | voyage flag | Fail → non-qualifying |
| Third-party bareboat | Art. 3.3.3(a) · ¶163–164 | **implemented** | duration engine | Non-CE shipping enterprise + `charterYears` (+ renewals) ≤ 3; missing/over-limit fails |
| Inland haulage (land) | ¶171 | **implemented** | `inland_transport` | Stays in GloBE |
| QAISI 50% cap | Art. 3.3.4 | **implemented** | two-CE test + Example 3.3.1-2 | Jurisdictional aggregation + pro-rata; not a live multi-CE seed |
| Management | Art. 3.3.6 | **implemented** | OR test | — |
| Covered Tax reduction | Art. 4.1.3(a) | **implemented** (shipping path) | `art413aReduction` | `excluded/taxable×current tax`; spill tax remains |
| Cost attribution | Art. 3.3.5 | **missing** | — | Net amounts assumed pre-computed — **hook stop**; needs revenue/cost split rewrite |

### Hook

```
FANIL (Art. 3.1)
  + Σ Art. 3.2 adjustments
  + Art. 3.3.1 globeDelta           ← lib/shipping.ts (if Art. 3.3.6 passes)
= GloBE Income

Adjusted Covered Taxes
  = current + Art. 4.4 deferred + other
  − Art. 4.1.3(a) reduction         ← incomeExcluded / taxableIncome × currentTaxExpense
```

Live seed: **SG-SHIP**. Rule id: `OECD-SHIP-33`.  
Verify: `npm run test:shipping` (58 assertions on second-read suite).

### Not claimed

- Full Art. 3.3.5 direct/indirect cost allocation (document hook: would need gross revenue + cost lines per activity, not net pack amounts)
- Broader Art. 4.3 CFC/PE/hybrid Covered Tax allocation (only shipping 4.1.3(a) proportional method)
- Shipping inside Simplified ETR beyond `SETR_SHIP` label

---

## 2. Coverage matrix (Model Rules chapters)

### Ch 1 — Scope

| Article / topic | Status | Code | Scenarios tests do **not** cover |
| --- | --- | --- | --- |
| Art. 1.1 EUR 750m / 2-of-4 | **partial** | `scopeTest` · `OECD-SCOPE-750` | No dedicated unit test file; mid-year joins; FX to EUR; Excluded Entity revenue carve-out |
| Art. 1.2–1.3 MNE / CE | **partial** | `ENTITIES` + `entityClass` | Flow-through / transparent CE edges |
| Art. 1.4 UPE | **partial** | `type: "UPE"` · `upeEntity()` | Dual-listed / dual-UPE; no isolated UPE unit tests |
| Art. 1.5 Excluded Entities | **partial** | Labels · `OECD_1.5.3` | Opt-in election not engine-driven on Aetherion |
| Stateless CE | **partial** | `XX-ST` blend | Stateless top-up allocation |
| JV (Art. 6.4 / 10.1) | **implemented** | `equityMethod` + UPE ≥ 50% · separate blend | Multi-tier JV subgroups |

### Ch 2 — Charging provisions

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 2.1 IIR (incl. POPE path) | **partial** | `allocateCollection` · POPE → UPE | Teaching waterfall on seed; Intermediate Parent chains and non-QDMTT residual IIR stress **not** unit-tested as Model Rules coverage |
| Art. 2.2 Inclusion Ratio | **partial** | `inclusionRatio` | Ownership % only; preferred shares / class differences absent |
| Art. 2.4–2.6 UTPR | **partial** | Residual UTPR bucket | No employees/assets UTPR allocation key |
| QDMTT priority | **partial** | Pack `qdmtt` flag | Domestic QDMTT income-definition divergence (Thai pack is separate overlay) |

### Ch 3 — GloBE Income

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 3.1.1 FANIL (UPE CFS) | **partial** | `fanilUsd` / `traceFanil` | Seeded path; no FANIL unit suite |
| Art. 3.1.2 / 3.1.3 local GAAP | **partial** | `OECD_3.1.3` · `gaapScreen` | Electable; not default live path |
| Art. 3.2.1(a)–(i) catalogue | **partial** | Few seeded deltas | **Largest remaining GloBE-income gap** — pension, insurance 3.2.9, equity gains default, etc. absent |
| Art. 3.2.2 SBC | **partial** | Election + optimizer overlay | TH overlay; IE static row |
| Art. 3.2.5 / 3.2.6 / 3.2.8 | **election-only** | Register | No realisation / aggregate-gain / intra-group engines |
| **Art. 3.3 shipping** | **partial → core rules + B2/M2–M7 tested** | `lib/shipping.ts` · `test-shipping.ts` | Art. 3.3.5 costs still missing |
| Art. 3.4 Allocation to PEs | **partial** | TH-PE separate CE row | No PE profit attribution engine |

### Ch 4 — Covered Taxes

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 4.1 Adjusted Covered Taxes | **partial** | `entityCovered` | CFC / hybrid / push-down largely stub |
| Art. 4.1.3(a) reduction for excluded Ch. 3 income | **partial** | Shipping path `art413aReduction` | Proved for shipping + Example 4.1.3-1 method; not a general excluded-dividend / all Ch. 3 engine |
| **Art. 4.3 allocation** of Covered Taxes | **missing** / **partial** | `otherCovered` stub | CFC, Hybrid, Main Entity ↔ PE, cross-border allocation not computed |
| Art. 4.1.5 → ACTTT | **partial** | LU seed posts ACTTT when globe ≤ 0 and covered < 0 | Carry-forward utilisation across years not ledger-proven; do **not** read as full Art. 4.1.5 machinery |
| Art. 4.4 DT recast / recapture | **partial** | `lib/deferredTax.ts` | Origin-year reopen not auto-refiled |
| Art. 4.5 GloBE Loss Election | **election-only** | Register + year-ledger locks | Deemed DTA method not fully computed |

### Ch 5 — ETR & Top-up

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 5.1.1 jurisdictional ETR | **partial** | `calculateGroup` | Live calc; no isolated ETR unit suite beyond shipping/engine smoke |
| Art. 5.1.2 / 5.1.3 blending | **partial** | `entityClass` · HK teaching | HK negative-tax teaching case; not a full Art. 5.1.2 scenario matrix |
| Art. 5.2.1–5.2.2 | **partial** | `topUpRate` · `excess` | Posted on seed; limited scenario tests |
| Art. 5.2.3 + ACTTT line | **partial** | `rateTopUp + additionalCurrentTopUp` | Formula posts on LU (4.1.5 path). **Not** a full Additional Current Top-up engine for prior-year recalculations / all Art. 5.2.3 triggers |
| Art. 5.3 SBIE | **partial** | Transitional rates · Thai override | PE / mobile employee substance incomplete |
| Art. 5.5 De minimis | **election-only** / **method text** | `OECD_5.5` + TCSH de minimis proxy | Standalone Art. 5.5 (non-TCSH) is **not** proven; do not treat TCSH de minimis as Art. 5.5 coverage |

### Ch 6 — Reorganisations & transfers

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 6.1–6.3 joining / leaving / transfers | **missing** | `OECD_6.3.4` register only | No GloBE carrying-value transfer engine |
| **Art. 6.4 JV Group** | **implemented** | Separate SG-JV blend · entity test | JV subsidiaries chain beyond one JV root |
| Art. 6.5 Multi-Parented MNE Groups | **missing** | — | — |

### Ch 7 — Tax neutrality & distribution regimes

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 7.1–7.2 | **missing** | Labels | — |
| Art. 7.3 EDTS | **election-only** | `OECD_7.3` | No deemed distribution tax computation |
| Art. 7.4–7.6 Investment Entities | **partial** | SG-IE separate blend | Transparency / taxable distribution methods not computed |

### Ch 8 — Administration

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| GIR / filings | **partial** | `/gir` · `/filings` | Prototype, not filing-grade XML |

### Ch 9 — Transition

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 9.1 transition attributes | **partial** | DT openings · `OECD_9.1.3` | Full transition limitations |
| Transitional CbCR Safe Harbour | **partial** | Navigator + `tcshBarredByPrior` | Routine profits is a demo proxy; SETR inner options mostly labels |
| Once out, always out | **partial** | Year ledger flags | Cross-group / restructure resets not modelled; limited scripted proof |

### Safe harbours / FX / elections

| Topic | Status | Note |
| --- | --- | --- |
| TCSH three tests | **partial** | Computed on seed; routine-profits proxy |
| QDMTT / SBTI / SbS / UTPR SH | **partial** | Pack flags / US Pass teaching |
| HoldCo vs JV separate SH | **implemented** | Per-`blendKey` |
| FX beyond TH | **partial** | `lib/fx.ts` |
| Elections that change numbers | See register | `OECD_3.2.2`, `OECD_3.1.3`, `OECD_4.1.5`, SBIE overlays, `SH_TCSH` move amounts; most other rows are eligibility text only |

---

## 3. Remaining gaps ranked by computation impact

| Rank | Gap | OECD | Why this rank | Status |
| --- | --- | --- | --- | --- |
| **1** | Full Art. 3.2 adjustment catalogue | 3.2.1+ | Systematic GloBE Income misstatement for non-shipping groups | **Partial** |
| **2** | Reorganisations / transfers / multi-parented groups | **6.1–6.3, 6.5** | Wrong GloBE carrying values after M&A (Art. **6.4 JV split out** — works) | **Missing** |
| **3** | Covered Tax allocation | **Art. 4.3** | CFC / PE / hybrid / cross-border Covered Taxes not allocated | **Missing** / stub |
| **4** | Charging cluster (IIR depth + UTPR 2.6 keys) | 2.1–2.6 | Residual charging and UTPR allocation incomplete | **Partial** |
| **5** | Art. 4.5 deemed loss DTA method | 4.5 | Covered-tax timing | **Election-only** |
| **6** | Investment Entity methods | 7.5–7.6 | Wrong blend / ETR | **Partial** |
| **7** | FX tables beyond TH | 3.1.3 / local | Presentation / QDMTT FX | **Partial** |
| **8** | FANIL local GAAP default path | 3.1.2–3.1.3 | Starting point | **Partial** |
| **9** | Art. 3.3.5 shipping cost attribution | 3.3.5 | Net shipping income assumed pre-baked — rewrite of pack shape | **Missing** (hook documented) |
| **10** | Look-through % on graph edges | 10.1 | UX / audit clarity | **Partial** |

Art. 3.3 core (3.3.1 / 3.3.2(a)–(d),(f) / 3.3.3(a) / 3.3.4 / 3.3.6 + ¶152/160/171 + Art. 4.1.3(a) shipping) is tested on this branch. Residual shipping work is Art. 3.3.5 (#9).

---

## 4. How to verify Art. 3.3

```bash
npm run test:shipping
```

UI: `/globe-income` → **Aetherion Maritime Pte. Ltd.** — Art. 3.3.1 exclusion; inland line remains in residual GloBE; audit cites Art. 3.3.4 (cap), Art. 3.3.6 (management), and Art. 4.1.3(a) tax reduction.

---

*Do not treat UI citations or teaching seeds as Model Rules coverage without a matching row above and a proving test. Draft stays draft until auditor re-read.*
