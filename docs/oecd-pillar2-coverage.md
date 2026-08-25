# OECD Pillar 2 (GloBE) coverage — GMT24

**Snapshot:** GMT24-CALC 2026.2 · Aetherion seed group  
**Legal sources:** OECD GloBE Model Rules (2021); Consolidated Commentary to the GloBE Model Rules; Agreed Administrative Guidance where cited in code  
**Honesty rule:** Status is *implemented* only where the engine posts a number **and** a test (or an equivalent scripted assertion) proves it. UI copy, election-register labels, and teaching seeds without scenario tests are *partial*, *election-only*, or *method text*.

Statuses: **implemented** · **partial** · **missing** · **election-only** · **method text**

---

## 1. Art. 3.3 International Shipping Income (deep-dive)

### Auditor remediation (Model Rules verification)

| Finding | Legal text | Disposition |
| --- | --- | --- |
| Management test is OR; cite 3.3.6 not 3.3.4 | Art. 3.3.6: “strategic **or** commercial management”; Art. 3.3.4 is the QAISI 50% cap (Commentary ¶172–173, ¶180) | **Confirmed — fixed** |
| Third-party bareboat is not QISI | Art. 3.3.2(d) / Commentary ¶157: bareboat-out is QISI only if lessee is another CE of the same MNE Group; Art. 3.3.3(a) / ¶163: third-party bareboat-out is QAISI (≤ 3 years) | **Confirmed — fixed** |
| Inland haulage is not QAISI | Commentary ¶171: inland transportation is **not** a qualified ancillary activity under Art. 3.3.3 — remains in GloBE Income | **Confirmed — fixed** (auditor’s “included” = included in GloBE, not in QAISI) |
| Art. 3.3.1 is mandatory | Art. 3.3.1: income/loss “**shall** be excluded” | **Confirmed — fixed** (removed election gate; removed `OECD_3.3` election row) |

No finding was discarded.

### Current status

| Topic | OECD | Status | Where | What the code does / what tests prove |
| --- | --- | --- | --- | --- |
| Mandatory exclusion | Art. 3.3.1 | **implemented** | `lib/shipping.ts` → `entityGlobe` | Exclusion runs when Art. 3.3.6 passes; no election switch |
| QISI categories | Art. 3.3.2 | **partial** | Category set + tests | Transport, intragroup bareboat-out, slot, pool/agency, ship sale. Holding-period / use-history for ship sale is a boolean fact, not computed |
| Third-party bareboat | Art. 3.3.3(a) · ¶163 | **implemented** | `bareboat_charter_third_party` as QAISI | Seed + tests; mis-labelled QISI rejected |
| Intragroup bareboat | Art. 3.3.2(d) · ¶157 | **implemented** | `bareboat_charter_intragroup` as QISI | Test-only fixture (not on live seed) |
| Inland haulage | Commentary ¶171 | **implemented** | `inland_transport` → non-qualifying | Stays in GloBE; SG-SHIP keeps $0.4m |
| QAISI 50% cap | **Art. 3.3.4** | **partial** | `jurisdictionalQaisiCap` | Jurisdictional aggregation + pro-rata spill; multi-CE same-jurisdiction stress beyond one seed is thin |
| Management test | **Art. 3.3.6** | **implemented** | `managementTestPass` (OR) | Strategic-only pass; commercial-only pass; both-fail disqualify |
| Covered Taxes on excluded shipping | Commentary ↔ Art. 4 | **partial** | Pack `coveredTaxesOnShipping` | Attributable amount is a fact input, not an Art. 4.3 allocation engine |
| Cost attribution | Art. 3.3.5 | **missing** | — | Net amounts assumed pre-computed in the shipping pack |
| Flag vs management | ¶182 | **implemented** | Tests | Flag alone does not fail 3.3.6 |

### Hook

```
FANIL (Art. 3.1)
  + Σ Art. 3.2 adjustments          ← ADJUSTMENTS[]
  + Art. 3.3.1 globeDelta           ← lib/shipping.ts (if Art. 3.3.6 passes)
= GloBE Income

Covered Taxes
  = current + Art. 4.4 deferred + other
  − Covered Taxes attributable to excluded shipping (pack fact)
```

Live seed: **SG-SHIP**. Rule id: `OECD-SHIP-33`.  
Verify: `npm run test:shipping`.

### Not claimed

- Full Art. 3.3.5 direct/indirect cost allocation engine
- Multi-year management-failure / evidence pack beyond boolean facts
- Shipping inside Simplified ETR beyond the existing `SETR_SHIP` label (SETR package — distinct from Art. 3.3.1)

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
| **Art. 3.3 shipping** | **partial → core rules implemented** | `lib/shipping.ts` · `test-shipping.ts` | See §1 — 3.3.5 costs still missing |
| Art. 3.4 Allocation to PEs | **partial** | TH-PE separate CE row | No PE profit attribution engine |

### Ch 4 — Covered Taxes

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 4.1 Adjusted Covered Taxes | **partial** | `entityCovered` | CFC / hybrid / push-down largely stub |
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
| **9** | Art. 3.3.5 shipping cost attribution | 3.3.5 | Net shipping income assumed pre-baked | **Missing** |
| **10** | Look-through % on graph edges | 10.1 | UX / audit clarity | **Partial** |

Art. 3.3 core (3.3.1 / 3.3.4 / 3.3.6 + Commentary bareboat / inland) is **no longer** on this ranked leftover list as an open shipping-classification gap; residual shipping work is Art. 3.3.5 (#9).

---

## 4. How to verify Art. 3.3

```bash
npm run test:shipping
```

UI: `/globe-income` → **Aetherion Maritime Pte. Ltd.** — Art. 3.3.1 exclusion; inland line remains in residual GloBE; audit cites Art. 3.3.4 (cap) and Art. 3.3.6 (management).

---

*Do not treat UI citations or teaching seeds as Model Rules coverage without a matching row above and a proving test.*
