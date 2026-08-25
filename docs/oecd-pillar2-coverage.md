# OECD Pillar 2 (GloBE) coverage — GMT24

**Snapshot:** GMT24-CALC 2026.2 · Aetherion seed group  
**Rule pack:** OECD Model Rules + 2026 Consolidated Commentary references cited in code  
**Honesty rule:** Status is *implemented* only where the engine posts a number and a test (or a seeded live path with an explicit audit trail) proves it. Citation / UI copy alone is *partial* or *method text*.

Statuses: **implemented** · **partial** · **missing** · **election-only** · **method text**

---

## 1. Art. 3.3 International Shipping Income (deep-dive)

### Verdict

**Previously missing** (only `SETR_SHIP` Simplified-ETR opt-out text in `lib/elections.ts`).  
**Now: implemented** on the existing GloBE income path (`FANIL + Art. 3.2` → plus Art. 3.3), with unit + engine tests.

| Topic | OECD | Status | Where | What the code does |
| --- | --- | --- | --- | --- |
| QISI exclusion from GloBE Income | Art. 3.3.1–3.3.2 | **implemented** | `lib/shipping.ts` → `entityGlobe` in `lib/engine.ts` | Qualifying QISI lines are subtracted from FANIL when elected and management tests pass |
| QAISI + 50% of QISI cap | Art. 3.3.3 | **implemented** | `qaisiCapOf` / `computeShippingExclusion` | Positive QAISI excluded up to 50% of QISI; spill stays in GloBE. If QISI ≤ 0, no QAISI exclusion |
| Strategic & commercial management in CE jurisdiction | Art. 3.3.4 | **implemented** | `ShippingFacts.strategicManagementInCeJur` / `commercialManagementInCeJur` | Either fail → full disqualification (no income or Covered Tax exclusion) |
| Ownership / bareboat / slot / inland / container leasing | Art. 3.3.2–3.3.3 | **implemented** (category gates) | `QisiCategory` / `QaisiCategory` | Categories classified; `qualifies: false` keeps line in GloBE (e.g. ship-sale holding-period gate) |
| Recapture / disqualification if management fails | Art. 3.3.4 | **implemented** | `disqualified` path in `computeShippingExclusion` | Shipping income remains in GloBE; no tax exclusion |
| Covered Taxes on shipping income | Art. 3.3 Commentary ↔ Art. 4 | **implemented** (attributable amount) | `shippingCoveredTaxExcluded` → `entityCovered` | Pack field `coveredTaxesOnShipping` leaves Adjusted Covered Taxes when income is excluded |
| Allocation across CEs / jurisdictions | Art. 3.3 + 5.1.1 | **partial** | Per-CE exclusion, then existing blend | Exclusion is CE-level; jurisdictional ETR uses post-exclusion blend. No separate shipping blend |
| Mixed shipping + non-shipping in one CE | — | **implemented** | Residual FANIL − shipping lines | Non-shipping residual stays in GloBE (SG-SHIP seed: $0.5m) |
| JV / look-through | Art. 6.4 / 10.1 | **partial** | Same module if a pack is attached | No auto look-through. SG-JV has no pack (test proves inert). JV blend already separate via `entityClass` |
| Loss-making shipping | Art. 3.3.1 | **implemented** | Tests | Excluding a QISI loss increases GloBE Income; QAISI blocked when QISI ≤ 0 |
| Sale of a ship | Art. 3.3.2 | **partial** | `ship_sale` + `qualifies` flag | Gate is a boolean fact, not a computed holding-period / use history engine |
| Flag vs management jurisdiction mismatch | Art. 3.3.4 | **implemented** | Flag on line; management on pack | Flag ≠ CE location does **not** fail; management location does |

### Hook (no parallel engine)

```
FANIL (Art. 3.1)
  + Σ Art. 3.2 adjustments          ← ADJUSTMENTS[]
  + Art. 3.3 globeDelta             ← lib/shipping.ts
= GloBE Income

Covered Taxes
  = current + Art. 4.4 deferred + other
  − Art. 3.3 coveredTaxesOnShipping
```

Live seed: **SG-SHIP** (`Aetherion Maritime Pte. Ltd.`) in Singapore main blend.  
Election register: `OECD_3.3` (CE / annual). Seed pack sets `electExclusion: true`.  
Rule id: `OECD-SHIP-33`.  
Tests: `npx tsx scripts/test-shipping.ts` (42 assertions).

### Not claimed

- Multi-year management-failure recapture across fiscal years (year ledger)
- Automatic allocation of Covered Taxes to shipping vs non-shipping beyond the pack’s attributable amount
- Shipping income inside Simplified ETR beyond the existing `SETR_SHIP` election label
- Full Commentary examples (pool / agency economics, tonnage-tax interactions)

---

## 2. Coverage matrix (Model Rules chapters)

### Ch 1 — Scope

| Article / topic | Status | Code | Scenarios tests do **not** cover |
| --- | --- | --- | --- |
| Art. 1.1 EUR 750m / 2-of-4 | **implemented** | `scopeTest` · `OECD-SCOPE-750` · `/scope` | Mid-year joins, FX to EUR for threshold, Excluded Entity revenue carve-out math |
| Art. 1.2–1.3 MNE / CE | **partial** | `ENTITIES` + `entityClass` | Flow-through / transparent CE edge cases beyond labels |
| Art. 1.4 UPE | **implemented** | `type: "UPE"` · `upeEntity()` | Dual-listed / dual-UPE structures |
| Art. 1.5 Excluded Entities | **partial** | `type: "Excluded"` · election `OECD_1.5.3` | Live seed has Thai memo excluded entity; opt-in election not engine-driven on Aetherion |
| Stateless CE | **partial** | `XX-ST` blend | Stateless top-up allocation nuances |
| JV (Art. 6.4 / 10.1) | **implemented** | `equityMethod` + UPE ≥ 50% · separate blend | Multi-tier JV subgroups |

### Ch 2 — Charging provisions

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 2.1 IIR | **implemented** | `allocateCollection` | Intermediate Parent IIR chains beyond POPE → UPE |
| Art. 2.1.4 POPE | **implemented** | `OECD-POPE-214` · UK-HC seed | POPE without QDMTT on low-tax children with residual IIR math stress tests |
| Art. 2.2 Inclusion Ratio | **implemented** | `inclusionRatio` | Preferred shares / different classes of Ownership Interests |
| Art. 2.4–2.6 UTPR | **partial** | Residual UTPR bucket | UTPR allocation key by employees/assets across UTPR jurisdictions not computed |
| QDMTT priority | **implemented** | Jurisdiction pack `qdmtt` | Domestic QDMTT income definition divergence (except Thailand pack overlays) |

### Ch 3 — GloBE Income

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 3.1.1 FANIL (UPE CFS) | **implemented** | `fanilUsd` / `traceFanil` | — |
| Art. 3.1.2 / 3.1.3 local GAAP | **partial** | `OECD_3.1.3` · `gaapScreen` · TH `fanilLocal` | Not elected by default on live path; material-difference screens exist |
| Art. 3.2.1(a)–(i) adjustments | **partial** | Seeded dividends, net tax, FX stub, policy disallowed, SBC | Many 3.2.1 categories absent (pension, insurance 3.2.9, equity gains default, etc.) |
| Art. 3.2.2 stock-based compensation | **partial** | Election + optimizer overlay | Live IE adjustment is static; TH election via `electionEngine` |
| Art. 3.2.5 / 3.2.6 / 3.2.8 | **election-only** | Register + optimizer stubs | No full realisation / aggregate-gain / intra-group engines |
| **Art. 3.3 shipping** | **implemented** | `lib/shipping.ts` · tests | See §1 |
| Art. 3.4 Allocation to PEs | **partial** | TH-PE separate CE row | No PE profit attribution engine |

### Ch 4 — Covered Taxes

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 4.1 Adjusted Covered Taxes | **partial** | `entityCovered` | CFC / hybrid / push-down allocations largely stub (`otherCovered`) |
| Art. 4.1.5 Net GloBE Loss + negative tax → ACTTT | **implemented** | `calculateGroup` ACTTT branch · LU seed · `OECD_4.1.5` | Carry-forward utilisation in later years not fully ledgered |
| Art. 4.4 deferred tax recast / recapture | **partial** | `lib/deferredTax.ts` · OECD-DT-441…445 | Full five-year recapture re-open of origin-year ETR is monitored, not auto-refiled |
| Art. 4.5 GloBE Loss Election | **election-only** | Register + year-ledger locks | Deemed DTA substitute method not fully computed |
| Cross-border DT allocation | **election-only** | `OECD_4_nbdt` | — |

### Ch 5 — ETR & Top-up

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 5.1.1 jurisdictional ETR | **implemented** | `calculateGroup` | — |
| Art. 5.1.2 / 5.1.3 blending (incl. MOCE) | **implemented** | `entityClass` blends · HK 5.1.2 teaching | Profit CE − Loss CE netting text vs multi-CE loss blending edge cases |
| Art. 5.2.1 Top-up % | **implemented** | `topUpRate` | — |
| Art. 5.2.2 Excess Profit | **implemented** | `excess` | — |
| Art. 5.2.3 Top-up + **Additional Current Top-up** | **implemented** | `rateTopUp + additionalCurrentTopUp` | Prior-year recalculation ACTTT (post-filing adjustments) not a full reopen engine |
| Art. 5.3 SBIE | **partial** | Transitional rates · Thai pack override | Substance attribution across PEs / mobile employees incomplete |
| Art. 5.5 De minimis | **partial** | TCSH de minimis + `OECD_5.5` election | Standalone Art. 5.5 (non-TCSH) path lightly wired |

### Ch 6 — Reorganisations & transfers

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 6.1–6.3 transfers / joining / leaving | **missing** / **election-only** | `OECD_6.3.4` register only | No GloBE carrying-value transfer engine |
| Art. 6.4 JV Group | **implemented** | Separate SG-JV blend | JV subsidiaries chain |

### Ch 7 — Tax neutrality & distribution regimes

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 7.1–7.2 flow-through / tax transparent UPE | **missing** | Labels only | — |
| Art. 7.3 EDTS | **election-only** | `OECD_7.3` | No deemed distribution tax computation |
| Art. 7.4–7.6 Investment Entities | **partial** | SG-IE separate blend · elections 7.5 / 7.6 | Transparency / taxable distribution methods not computed |
| Art. 7 Insurance / other | **missing** | — | — |

### Ch 8 — Administration

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| GIR / filings | **partial** | `/gir` · `/filings` · election GIR fields | XML schema generation is prototype, not filing-grade |
| Soft-landing / penalties | **missing** | — | — |

### Ch 9 — Transition

| Article / topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Art. 9.1 deferred tax attributes at transition | **partial** | DT opening balances · `OECD_9.1.3` | Full transition DTA/DTL limitations |
| Transitional CbCR Safe Harbour | **implemented** | `OECD-TCSH-2026` · navigator | Simplified ETR inner SETR options mostly election labels |
| **Once out, always out** | **implemented** | `tcshBarredByPrior` · year ledger `tcshFailed` / `tcshUsed` | Cross-group / restructure resets not modelled |

### Safe harbours (beyond Ch 8/9)

| Harbour | Status | Code | Gaps |
| --- | --- | --- | --- |
| TCSH (de minimis / simplified ETR / routine profits) | **implemented** | `calculateGroup` SH block | Routine profits is a demo proxy (`10% × CbCR revenue`) |
| QDMTT Safe Harbour | **partial** | Pack flags + Central Record memo | Not a full AG qualification engine |
| Simplified Calculations / NMCE | **election-only** | Register | — |
| SBTI / Side-by-Side / UPE SH / UTPR SH | **partial** | US seed Pass; others Review/N/A | Substance tracing for SBTI incomplete |
| HoldCo vs JV separate SH | **implemented** | Per-`blendKey` navigator | — |

### FX / functional currency

| Topic | Status | Code | Gaps |
| --- | --- | --- | --- |
| Presentation USD + locked FX table | **partial** | `lib/fx.ts` | Thailand BOT archive strongest; JP/SG/VN not full jurisdictional FX libraries |
| QDMTT currency election | **election-only** | `OECD_QDMTT_FX` · Thai pack | — |

### Elections that change computation

| Election | Computational effect today |
| --- | --- |
| `OECD_3.2.2` | Yes — optimizer / electionEngine overlay |
| `OECD_3.1.3` | Yes — local FANIL if screens pass |
| `OECD_4.1.5` | Yes — suppresses ACTTT |
| `OECD_5.3.1` / SBIE max·partial·none | Yes — overlay |
| `SH_TCSH` | Yes — zeros top-up when tests pass |
| `OECD_3.3` | Yes — via shipping pack `electExclusion` (register present; seed pack elected) |
| Most other register rows | Eligibility / scenario text only |

---

## 3. Known product gaps (P2 question table) — ranked by computation impact

| Rank | Gap | OECD | Impact if wrong | Status in GMT24 now |
| --- | --- | --- | --- | --- |
| 1 | Art. 3.3 shipping | 3.3 | Inflated GloBE / wrong ETR for shipping groups | **Closed** (this PR) |
| 2 | Ch 6 reorganisations / carrying values | 6.x | Wrong GloBE basis after M&A | **Missing** |
| 3 | UTPR allocation keys | 2.6 | Wrong residual charging | **Partial** |
| 4 | Full Art. 3.2 catalogue | 3.2.1+ | Systematic GloBE misstatement | **Partial** |
| 5 | Art. 4.5 deemed loss DTA method | 4.5 | Covered tax timing | **Election-only** |
| 6 | Investment Entity methods | 7.5–7.6 | Wrong blend / ETR | **Partial** |
| 7 | FX tables beyond TH | 3.1.3 / local | Presentation / QDMTT FX | **Partial** |
| 8 | FANIL local GAAP switch | 3.1.2–3.1.3 | Starting point | **Partial** (electable) |
| 9 | Look-through % on graph edges | 10.1 | UX / audit clarity | **Partial** (computed, not drawn) |
| 10 | SETR inner elections | 2026 SETR | Simplified harbour income | **Mostly labels** |

Historical P2 rows (ACTTT 5.2.3, Art. 4.1.5, Art. 5.1.2, once-out-always-out, SG HoldCo vs JV) are **implemented** on the live engine path with teaching seeds (LU, HK, year ledger, SG blends) — still limited by the scenarios noted above.

---

## 4. How to verify Art. 3.3

```bash
npx tsx scripts/test-shipping.ts
```

UI: `/globe-income` → select **Aetherion Maritime Pte. Ltd.** — waterfall shows Art. 3.3 exclusion; Covered Taxes audit shows shipping tax stripped.

---

*Generated for the Art. 3.3 shipping gap closure. Do not treat UI citations as coverage without a matching row in §2–§3.*
