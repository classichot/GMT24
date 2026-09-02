import { ACCOUNTS, ENTITIES, INCENTIVES, ISSUES, RULES } from "./model";
import { calculateGroup, calcForIso, entityCalc, type JurCalc } from "./engine";
import { shippingPost } from "./shipping";
import { eur, pct, thb } from "./format";
import { reviewOecdRdGap } from "./thaiGap";
import { optimizeBoi } from "./boiOptimizer";
import { optimizeGlobe } from "./electionEngine";
import { WORKED_SBC_THB } from "./elections";

export type CopilotMsg = {
  role: "user" | "assistant";
  text: string;
  cites?: { label: string; href?: string }[];
};

function th() {
  return calcForIso("TH")!;
}

const CANNED: { match: RegExp; answer: (q: string) => CopilotMsg }[] = [
  {
    match: /evidence history|immutable (log|chronicle)|who (changed|approved|commented)|chronicle|evidence locker/i,
    answer: () => ({
      role: "assistant",
      text: "Evidence history is the group chronicle: documents ingested, mapping and election changes, engine calculation snapshots, user sessions/actions, and comments — in time order.\n\nEach row stores a hash of the previous row (GMT24-EH-v1). Immutability is on by default: existing rows cannot be edited or deleted; new rows still append (WORM). Turn it off in Settings or on the history page to delete or reset a working log; turning it off is itself logged.\n\nThe Evidence locker is the file list. The Audit trail is amount → OECD rule → source file. Evidence history is who did what, when, on which document or calc.\n\nOpen Evidence history.",
      cites: [
        { label: "Evidence history", href: "/evidence-history" },
        { label: "Evidence locker", href: "/evidence" },
        { label: "Settings", href: "/settings" },
        { label: "Audit trail", href: "/audit" },
      ],
    }),
  },
  {
    match: /year record|prior year|previous year|next year|fy2027|election compare|consistenc|carried lock|lock (the )?year/i,
    answer: () => ({
      role: "assistant",
      text: "Year record works in In-house and Advisor. Advisor keeps a separate ledger per client.\n\n1. Working package = live calc + election toggles. Not final until Lock.\n2. Lock writes engine amounts and GIR elections for that Fiscal Year.\n3. Open next year — five-year locks and Art. 4.5 carry. Annual elections do not.\n4. Compare prior vs current: carried / added / dropped elections, and GloBE / covered taxes / ETR / top-up movement.\n5. Blocks: dropping a five-year lock early, or re-electing Art. 4.5 after revocation.\n\nLater years still run on this snapshot’s data model until new books are loaded.\n\nOpen Year record — the How this works table is on that page.",
      cites: [
        { label: "Year record", href: "/years" },
        { label: "Election engine", href: "/elections" },
        { label: "Clients", href: "/clients" },
      ],
    }),
  },
  {
    match: /host desk|\bbhd\b|demo (invite|link)|review link|mint (a )?link/i,
    answer: () => ({
      role: "assistant",
      text: "Host desk mints a time-limited GMT24 demo URL. Open /host, set days (1–30, default 3), Generate, then send only that URL.\n\nThe expiry is signed into /review/{token}, so a recipient on another device can open Aetherion until the clock runs out. After that the same URL shows Access ended.\n\nThe host key unlocks Advisor on this browser. It is never shown on public login. To kill every live link at once, bump INVITE_EPOCH and redeploy.",
      cites: [
        { label: "Host desk", href: "/host" },
        { label: "Approvals", href: "/approvals" },
      ],
    }),
  },
  {
    match: /optimize (my )?globe|scenario optimizer|election package|lowest (fy|5-year|compliance)|pillar two scenario/i,
    answer: () => {
      const O = optimizeGlobe(calculateGroup());
      const rec = O.recs[4].scenario;
      const fy = O.recs[0].scenario;
      return {
        role: "assistant",
        text: `GMT24 Pillar Two Scenario Optimizer — engine overlay on GloBE Core, not a copilot guess.\n\nRegister: ${O.counts.total} elections/harbours · ${O.counts.available} available · ${O.counts.review} review · ${O.counts.unavailable} unavailable · ${O.counts.fiveYear} five-year locks.\n\nBaseline group top-up ${eur(O.groupBase)}.\nLowest FY2026 tax: ${fy.title} → ${eur(fy.fyTopUp)}.\nRecommended balanced position: ${rec.title} → ${eur(rec.fyTopUp)} (QDMTT ${eur(rec.fyQdmtt)}, IIR ${eur(rec.fyIir)}, UTPR ${eur(rec.fyUtpr)}).\n\nThailand fails Transitional CbCR — that harbour cannot be elected. Simplified ETR / SBTI are Review, not a $0 booking. Ireland Art. 3.2.2 is available but tax deduction is below book, so it is rejected.\n\nOpen Optimize my GloBE position.`,
        cites: [
          { label: "Optimize GloBE", href: "/optimize" },
          { label: "Election engine", href: "/elections" },
          { label: "OECD-ELEC-2026", href: "/rulebook" },
          { label: "Commentary 2026", href: "https://www.oecd.org/en/publications/tax-challenges-arising-from-the-digitalisation-of-the-economy-consolidated-commentary-to-the-global-anti-base-erosion-model-rules-2026_4377e89f-en.html" },
        ],
      };
    },
  },
  {
    match: /3\.2\.2|stock.?comp|stock.?option|equity compensation|sbc election/i,
    answer: () => {
      const O = optimizeGlobe(calculateGroup());
      const W = WORKED_SBC_THB;
      return {
        role: "assistant",
        text: `Article 3.2.2 is a five-year jurisdiction election. It is not entity-by-entity. It binds every Constituent Entity located in that country — on this snapshot TH001 and the Rayong PE together.\n\nDefault: financial-accounting stock-comp expense stays in GloBE Income.\nElection: local tax deduction is substituted into GloBE Income.\n\nTeaching illustration (THB):\nABC Thailand tax ${thb(W.entities[0].tax, true)} / book ${thb(W.entities[0].book, true)}\nXYZ Thailand tax ${thb(W.entities[1].tax, true)} / book ${thb(W.entities[1].book, true)}\nWithout election → ETR ${pct(W.without.etr, 1)} → top-up ${thb(W.without.topUp, true)}\nWith election → ETR ${pct(W.with.etr, 1)} → top-up ${thb(W.with.topUp, true)}\n\nLive Aetherion overlay: Core Thai ETR ${pct(O.thBase.etr, 1)} / top-up ${eur(O.thBase.jurisdictionalTopUp)}. With Art. 3.2.2 → Thai ETR ${pct(O.thA.etr, 1)} / top-up ${eur(O.thA.topUp)}.\nIreland is legally available but tax deduction is below book — optimizer will not recommend it.\n\nOpen the Election Engine.`,
        cites: [
          { label: "Art. 3.2.2 register", href: "/elections" },
          { label: "Optimize GloBE", href: "/optimize" },
          { label: "OECD-ELEC-2026", href: "/rulebook" },
        ],
      };
    },
  },
  {
    match: /election engine|globe election|simplified etr (inner|election)|unclaimed accrual|realisation principle|sbie opt.?out/i,
    answer: () => {
      const O = optimizeGlobe(calculateGroup());
      return {
        role: "assistant",
        text: `The Election & Scenario Engine tracks OECD GloBE elections, 2026 safe harbours, and Simplified ETR inner options at the legal scope (group / jurisdiction / CE / transaction / asset class / DTL item / GL account).\n\nThis snapshot: ${O.counts.available} available, ${O.counts.review} review, ${O.counts.unavailable} unavailable, of ${O.counts.total} on the register.\n\nSBIE is modelled as maximum / partial / none — not a silent YES. Unclaimed accruals are DTL-item (annual) or GL-category (five-year). Art. 4.5 GloBE Loss: first GIR, revocable YES, re-elect after revocation NO.\n\nOpen the register, then Optimize my GloBE position.`,
        cites: [
          { label: "Election engine", href: "/elections" },
          { label: "Optimize GloBE", href: "/optimize" },
          { label: "GIR section D", href: "/gir" },
        ],
      };
    },
  },
  {
    match: /oecd vs|rd gap|diverge|thai rd|pillar ?2 rd|rd requirement|pure oecd/i,
    answer: () => {
      const R = reviewOecdRdGap(th());
      return {
        role: "assistant",
        text: `OECD Model Rules + GMT24 GloBE Core are not the Thai RD Pillar Two file.\n\nThis snapshot: ${R.headline}.\nScope: OECD ${R.oecdScope} (USD 750m) vs Thai BOT ${R.thaiScope}.\nSBIE delta (Thai − OECD) ${eur(R.sbieDelta)}.\nTop-up ${eur(R.topUp)} is collected as Thai QDMTT ${eur(R.payable)} — collection is aligned; SBIE, FX and situs are not.\n\nGround of analysis: if OECD and RD conflict, cite the Thai instrument (Decree / DG notification). If they do not, cite the 2026 Commentary. Pending RD instruments (ss 31, 33, 53–57) are documented exceptions — see RD news 5/2026. Do not invent those rules in the copilot.\n\nOpen the OECD vs RD gap review. Every topic has a source trail (OECD article → RD instrument → GMT24 rule).`,
        cites: [
          { label: "OECD vs RD gap", href: "/thailand/gap" },
          { label: "RD GloBE mapping PDF", href: "https://www.rd.go.th/fileadmin/user_upload/porsor/topuptaxreference_170269.pdf" },
          { label: "OECD Commentary 2026", href: "https://www.oecd.org/en/publications/tax-challenges-arising-from-the-digitalisation-of-the-economy-consolidated-commentary-to-the-global-anti-base-erosion-model-rules-2026_4377e89f-en.html" },
          { label: "Emergency Decree B.E. 2567", href: "https://www.rd.go.th/67365.html" },
          { label: "Playbook", href: "/playbook/oecd-rd-gap" },
        ],
      };
    },
  },
  {
    match: /thailand pack|jurisdiction pack|thai liability|who pays the thai|thai qdmtt|residual utpr/i,
    answer: () => {
      const j = th();
      return {
        role: "assistant",
        text: `The Thailand Jurisdiction Pack (TH-PACK-2567 v2567.2) sits on top of GMT24 Global GloBE Core. It does not translate the OECD engine into Thai.\n\nThai liability waterfall for FY2026:\nJurisdictional top-up ${eur(j.jurisdictionalTopUp)}\n− Foreign QDMTT $0 (this is the QDMTT jurisdiction)\n− IIR already imposed $0 (UPE is Japan; Thai IIR is N/A)\n= Residual UTPR $0\n→ Thai QDMTT collects ${eur(j.jurisdictionalTopUp)}\n→ Designated taxpayer TH001 (draft election; joint and several remains).\n\nLegal coverage: calculation rules available / filing schema pending (ss 31, 33, 53–57). Do not treat GMT24 as fully ready for Thai filing.\n\nOpen the Thai Liability Dashboard.`,
        cites: [
          { label: "TH-PACK-2567 v2567.2", href: "/thailand" },
          { label: "Thai liability dashboard", href: "/thailand/liability" },
          { label: "TH-QDMTT-2025", href: "/rulebook" },
        ],
      };
    },
  },
  {
    match: /thai sbie|notification no\.?\s*4|mof notification/i,
    answer: () => ({
      role: "assistant",
      text: `Thai SBIE is Notification No. 4 plus MOF Notification No. 1 — not a copy of the OECD carve-out screen.\n\nPayroll includes full-time, temporary, ordinary-activity contractors, bonus/SBC/SSC, proportional days where work in Thailand is 50% or less, and excludes capitalised payroll already in PPE.\nAssets include PPE, ROU, tangible-linked government licences; revaluation uplift is out; average opening/closing carrying value.\n\nRates follow the fiscal-year start date. FY beginning 2026-01-01: payroll 9.4% / assets 7.4%, stepping down to 5%/5% from 2033.\n\nOpen the Thai SBIE Engine to reconcile against the GloBE Core SBIE.`,
      cites: [
        { label: "TH-SBIE-MOF-1 v2567.2", href: "/thailand/sbie" },
        { label: "OECD SBIE (core)", href: "/sbie" },
      ],
    }),
  },
  {
    match: /bot|bank of thailand|exchange.rate|750m.*thb|thb.*750/i,
    answer: () => ({
      role: "assistant",
      text: `DG Notification No. 6 locks three BOT methods:\n\n1. EUR statutory thresholds → THB: December-preceding average midpoint. FY2026 EUR/THB 36.8247 is archived (BOT-EUR-THB-202512). EUR 750m = about ฿27.6B.\n2. Foreign-currency CFS → THB: the same prescribed December rate (USD/THB 38.45 for FY2026).\n3. Actual payment/refund → THB: commercial-bank average buy/sell on the last business day before approval.\n\nA user cannot apply a convenient year-end rate without a validation warning. The snapshot does not restate.\n\nOpen BOT FX.`,
      cites: [{ label: "BOT FX Engine", href: "/thailand/fx" }, { label: "Thai scope memorandum", href: "/thailand/scope" }],
    }),
  },
  {
    match: /thai (return|filing|section 57|section 54)|when is the thai/i,
    answer: () => ({
      role: "assistant",
      text: `Thai Filing Command Centre clocks (Emergency Decree):\n\n• s 54 UPE / GIR-filer notification — 15 months from FY end → 31 Mar 2028 for FY2026\n• ss 55–56 local GIR or exchange exemption — 15 months → 31 Mar 2028\n• s 57 Thai return and payment — 15 months → 31 Mar 2028\n• s 58 first in-scope year (FY2025) — 18 months → 30 Jun 2027 (filed in this demo)\n\nCAA/exchange with Japan is under review before relying on a local GIR exemption. Electronic form schema is not in the pack. Do not market GMT24 as fully ready for Thai filing.\n\nThai tax ID for TH001 (demo): 0107558000121.`,
      cites: [{ label: "Filing command centre", href: "/thailand/filing" }, { label: "OECD GIR", href: "/gir" }],
    }),
  },
  {
    match: /rayong pe|situs|dual.resid|notification no\.?\s*3/i,
    answer: () => ({
      role: "assistant",
      text: `Rayong is a fixed-place / manufacturing PE of Aetherion (Thailand) Ltd., located in Thailand, blended in the Thai QDMTT. Notification No. 3 four PE categories were reviewed; treaty tie-breaker is not required.\n\nTH001 itself is a Thai CE (TFRS, UPE look-through 100%, not dual-resident, not an Excluded Entity). Entity test: not MOCE (UPE ownership 100% > 30%), not POPE.\nNo Notification No. 7 excluded entity in Thailand.\n\nEach classification stores result, period, facts, evidence, Thai provision, OECD interpretation and reviewer. Open Entity situs or the group entity test.`,
      cites: [{ label: "Thai entity situs", href: "/thailand/entities" }, { label: "Entity test", href: "/entities" }, { label: "Ownership graph", href: "/graph" }],
    }),
  },
  {
    match: /\bmoce\b|minority-owned|pope|partially-owned parent|inclusion ratio|entity test/i,
    answer: () => {
      const list = calculateGroup();
      const special = list.filter((c) => c.blendKind !== "main" && c.jurisdictionalTopUp > 0);
      return {
        role: "assistant",
        text: `Entity test is computed from the ownership chain (OECD-MOCE-513 / OECD-POPE-214 / OECD-IR-222 / OECD-JV-64 v2026.1).\n\nMOCE — Art. 5.1.3 / 10.1: UPE Ownership Interests ≤ 30%. Separate ETR from majority CEs in the same country. This snapshot: Aetherion Penang Components (MY028) is 28% UPE-owned — MOCE, not blended with Aetherion Malaysia Sdn. Bhd. PT Aetherion Indonesia is 99% — not MOCE.\n\nPOPE — Art. 2.1.4: a non-UPE Parent where outsiders hold more than 20%. IIR applies at the POPE first × Inclusion Ratio; UPE takes the residual. This snapshot: Aetherion UK Ltd. is 78% group-owned (22% outside) — POPE. European QDMTT still collects first, so POPE IIR residual is $0 there. Vietnam has no POPE on the chain (SG-HC is 100% group-owned) — UPE IIR.\n\nJV — Art. 6.4: Aetherion-Keppel Logistics is a separate Singapore ETR, not mixed with the HoldCo.\n\nSpecial blends with top-up: ${special.map((c) => `${c.name} (${c.collection.payer})`).join("; ") || "none on this snapshot besides majority-CE exposure"}. Open the entity register.`,
        cites: [
          { label: "Entity test", href: "/entities" },
          { label: "OECD-MOCE-513", href: "/rulebook" },
          { label: "OECD-POPE-214", href: "/rulebook" },
          { label: "Allocation", href: "/allocation" },
        ],
      };
    },
  },
  {
    match: /net retained|survives qdmtt|boi.*qdmtt|incentive value/i,
    answer: () => {
      const j = th();
      return {
        role: "assistant",
        text: `BOI headline 0% CIT is not what the group keeps.\n\nNominal BOI benefit = 20% CIT not paid on promoted GloBE income.\nMinus Thai QDMTT ${eur(j.jurisdictionalTopUp)} (this snapshot).\nMinus foreign IIR/UTPR $0 after Thai QDMTT.\n= Net retained incentive value.\n\nThe BOI Optimizer ranks keep-holiday vs 10% conversion vs QRTC (not bookable) vs 20% baseline on a 10-year NPV. SBTISH remains a candidate if qualifying expenditure is traced.`,
        cites: [{ label: "BOI Optimizer", href: "/thailand/boi" }, { label: "Playbook", href: "/playbook/boi-optimizer" }, { label: "TH-BOI certificate", href: "/incentives" }],
      };
    },
  },
  {
    match: /deferred tax|recast|dtl recapture|recapture exception|4\.4\.|time machine/i,
    answer: () => {
      const j = th();
      return {
        role: "assistant",
        text: `Deferred tax is in the ETR numerator, not a GloBE-income adjustment.\n\n1. Recast (Art. 4.4.1): Thai CIT 20% DTL is counted at 15%. A high statutory rate cannot inflate ETR.\n2. DTA: tax losses are tracked through utilisation so a later low-current-tax year is not mistaken for undertaxation. Deemed DTAs are held until evidence exists.\n3. Recapture (Art. 4.4.4): non-excepted DTLs that have not reversed by the fifth subsequent year reopen the origin-year ETR.\n\nThailand FY2026: Covered taxes ${eur(j.coveredTax)} ÷ GloBE ${eur(j.globeIncome)} = ETR ${pct(j.etr, 2)}. Open Deferred Tax Intelligence for the pipeline, DTA ledger, recapture clocks and Time Machine.\n\nRules OECD-DT-441 / OECD-DT-444 / OECD-DT-445 v2026.1.`,
        cites: [
          { label: "OECD-DT-441 Art. 4.4.1", href: "/deferred-tax" },
          { label: "OECD-DT-444 Art. 4.4.4", href: "/deferred-tax" },
          { label: "OECD-DT-445 Art. 4.4.5", href: "/deferred-tax" },
        ],
      };
    },
  },
  {
    match: /thailand.*etr|etr.*thailand|11\.|10\./i,
    answer: () => {
      const j = th();
      return {
        role: "assistant",
        text: `Thailand’s jurisdictional ETR is ${pct(j.etr, 2)}.\n\nCovered taxes ${eur(j.coveredTax)} ÷ GloBE income ${eur(j.globeIncome)}.\n\nThe reduction versus the 15% minimum is driven by Aetherion (Thailand) Ltd. (TH001): BOI holiday income taxed at 0%, deferred tax recast at 15%, and excluded dividends of $1.84M under Art. 3.2.1(b). Rayong PE is included in the Thai blending.\n\nCalculation snapshot GMT24-CALC 2026.2 · rule OECD-GloBE-15 v2026.1.`,
        cites: [
          { label: "OECD-GloBE-15 v2026.1", href: "/rulebook" },
          { label: "TH001 Trial Balance FY2026.xlsx", href: "/data" },
          { label: "BOI_Certificate_TH001.pdf", href: "/incentives" },
        ],
      };
    },
  },
  {
    match: /safe harbour|safe harbor|qualify/i,
    answer: () => {
      const j = th();
      return {
        role: "assistant",
        text: `Thailand does not qualify for the Transitional CbCR Safe Harbour in FY2026.\n\n${j.sh.navigator}\n\nQDMTT Safe Harbour is not available because a full GloBE top-up of ${eur(j.jurisdictionalTopUp)} is computed and collected as Thai QDMTT (rule TH-QDMTT-2025, Central Record transitional qualified).\n\nSBTISH (Substance-based Tax Incentive Safe Harbour) is under review for the BOI holiday — the incentive is substance-based, but GMT24 still needs qualifying expenditure tracing before the harbour can be elected.\n\nRule versions: OECD-TCSH-2026 v2026.2 · OECD-SBTISH v2026.2 · TH-QDMTT-2025 v2025.1.`,
        cites: [{ label: "OECD-TCSH-2026 v2026.2", href: "/safe-harbours" }, { label: "TH-QDMTT-2025", href: "/rulebook" }],
      };
    },
  },
  {
    match: /once out|always out|tcsh barred|barred next/i,
    answer: () => {
      const j = th();
      return {
        role: "assistant",
        text: `Once out, always out applies to the Transitional CbCR Safe Harbour.\n\nThailand ${j.sh.outcome} in FY2026. ${j.sh.navigator}\n\nLock this year and open FY2027: TCSH is barred for that blend. A Pass that is not elected on the GIR (SH_TCSH) is also treated as not used. QDMTT Safe Harbour and SBTISH are separate tests.\n\nOpen Safe Harbour Navigator and Year record.`,
        cites: [{ label: "OECD-TCSH-2026", href: "/safe-harbours" }, { label: "Year record", href: "/years" }],
      };
    },
  },
  {
    match: /ente|excess negative tax|30% top.?up|top.?up (tax )?(percentage|%) (exceeds|above|over)|max(imum)? rate under pillar|why.{0,60}30%|hong kong.{0,40}(top.?up|etr|negative)|negative (covered )?tax.{0,40}30/i,
    answer: () => {
      const hk = calcForIso("HK");
      return {
        role: "assistant",
        text: `15% is the Pillar Two Minimum Rate — the ETR target — not a cap you apply after a negative ETR.\n\nBare Art. 5.2.1: Top-up % = 15% − ETR. If Covered Taxes are negative and GloBE Income is positive, ETR is negative and Top-up % exceeds 15% (Hong Kong teaching facts: −$120k ÷ $800k = −15%, then 15% − (−15%) = 30%).\n\nOECD Administrative Guidance (February 2023) makes Excess Negative Tax Expense mandatory in that case. GMT24 excludes the negative tax from this year’s numerator, floors ETR at 0%, holds Top-up % at 15%, and carries the negative tax forward.\n\nHong Kong on this snapshot: raw Covered Taxes ${hk ? eur(hk.coveredTaxRaw) : "n/a"} · ACT for ETR ${hk ? eur(hk.coveredTax) : "n/a"} · ETR ${hk ? pct(hk.etr, 2) : "n/a"} · Top-up % ${hk ? pct(hk.topUpRate, 2) : "n/a"} · ENTE carry-forward ${hk ? eur(hk.enteCarryforward) : "n/a"}.\n\nArt. 4.1.5 is different — that is a GloBE Loss year (Luxembourg). ENTE is elective there.`,
        cites: [{ label: "Hong Kong ETR", href: "/etr?iso=HK" }, { label: "Top-up", href: "/top-up" }, { label: "Covered taxes", href: "/covered-taxes" }],
      };
    },
  },
  {
    match: /4\.1\.5|additional current|acttt|negative tax expense/i,
    answer: () => {
      const lu = calcForIso("LU");
      return {
        role: "assistant",
        text: `Art. 5.2.3: Jurisdictional Top-up = (Top-up % × Excess Profit) + Additional Current Top-up Tax − QDMTT.\n\nArt. 4.1.5: when Net GloBE Income is a loss and Adjusted Covered Taxes are negative, the negative tax is Additional Current Top-up Tax unless OECD_4.1.5 is elected (carry-forward).\n\nLuxembourg on this snapshot: GloBE ${lu ? eur(lu.globeIncome) : "n/a"} · Covered taxes ${lu ? eur(lu.coveredTax) : "n/a"} · ACTTT ${lu ? eur(lu.additionalCurrentTopUp) : "n/a"} · collected ${lu?.collection.payer ?? "—"}.\n\nHong Kong is not Art. 4.1.5. Positive GloBE + negative Covered Taxes → mandatory Excess Negative Tax Expense so Top-up % cannot exceed 15%.`,
        cites: [{ label: "Luxembourg ETR", href: "/etr?iso=LU" }, { label: "Hong Kong ETR", href: "/etr?iso=HK" }, { label: "Top-up", href: "/top-up" }],
      };
    },
  },
  {
    match: /boi optim|should we keep the boi|convert to 10%|announcement no\.?\s*1\/2566|qrtc|stranded boi|10% boi|wait for qrtc|net economic value after/i,
    answer: () => {
      const j = th();
      const O = optimizeBoi(j);
      const keep = O.scenarios.find((s) => s.id === "keep")!;
      const conv = O.scenarios.find((s) => s.id === "convert10")!;
      return {
        role: "assistant",
        text: `Pillar Two does not cancel BOI. It changes the economic value.\n\n${O.headline}\n\nBookable ranking (10-year cash-tax NPV, ${(O.discountRate * 100).toFixed(0)}%):\n• Keep 0% holiday — NPV ${eur(keep.npvCash)} · FY2026 net retained ${eur(keep.fy0.netBenefit)}\n• Convert to 10% (Announcement 1/2566) — NPV ${eur(conv.npvCash)}. 10% is still below 15%, so CIT plus top-up still arises. Not automatically cheaper.\n• No CIT incentive (20% baseline) — higher cash tax; non-tax BOI privileges remain.\n• QRTC / SBTISH — ${O.qrtc.status.toUpperCase()}. ${O.qrtc.note}\n\n${O.recommendation}\n\nDo not tell the board the certificate is 0% CIT. Open the BOI Optimizer.`,
        cites: [
          { label: "BOI Optimizer", href: "/thailand/boi" },
          { label: "Playbook", href: "/playbook/boi-optimizer" },
          { label: "TH-BOI-OPT-2566", href: "/rulebook" },
        ],
      };
    },
  },
  {
    match: /boi|holiday|expire/i,
    answer: () => {
      const inc = INCENTIVES.find((i) => i.id === "TH-BOI")!;
      return {
        role: "assistant",
        text: `The Thai BOI certificates run as a portfolio, not a single 0% promise.\n\nElectronics manufacturing (TH-BOI): ${inc.start} → ${inc.end}: ${inc.rate}.\nAutomation annex (TH-BOI-AUTO) is a separate project account, blended in the same Thai ETR.\n\nIf the holiday expires, current tax rises toward 20% CIT and Thai top-up falls. That is one of four optimizer scenarios — not a reason to drop BOI without an NPV.\n\nAnnouncement 1/2566 (convert to 10%) is not automatically cheaper: 10% is still below 15%. QRTC is not enacted; do not book it.\n\nSource: ${inc.extractedFrom} · rule TH-BOI-OPT-2566 v2567.2.`,
        cites: [{ label: inc.extractedFrom, href: "/thailand/boi" }, { label: "BOI Optimizer", href: "/thailand/boi" }, { label: "OECD-SBTISH v2026.2", href: "/safe-harbours" }],
      };
    },
  },
  {
    match: /singapore.*missing|missing.*singapore|data.*sg/i,
    answer: () => ({
      role: "assistant",
      text: `Singapore data gaps:\n\n1. CbCR revenue $88.0M vs consolidation $86.4M ($1.6M). Likely the 50% JV is in CbCR but equity-accounted in consolidation.\n2. DEI incentive agreement conditions (headcount / spending) are extracted but not tied to SBIE payroll.\n3. Mapping for HoldCo dividend accounts is approved; JV TB is only 72% complete.\n\nGMT24 cannot finish a lock-quality Singapore harbour file until the CbCR bridge is signed off. A data request to L. Tan is ready in Data Requests.`,
      cites: [{ label: "IQ-04 CbCR vs consolidation" }, { label: "OECD-TCSH-2026" }],
    }),
  },
  {
    match: /germany|yoy|increase/i,
    answer: () => ({
      role: "assistant",
      text: `Germany has no FY2026 top-up (ETR 25%+). There is no year-on-year top-up increase.\n\nIf you are looking at covered taxes, Germany current tax rose with higher FANIL. The AI Reviewer has not flagged an unexplained movement versus FY2025 GIR.\n\nRule OECD-GloBE-15 v2026.1 · source: DE001 tax provision / prior GIR FY2025.xml.`,
      cites: [{ label: "Prior_GIR_FY2025.xml" }],
    }),
  },
  {
    match: /shipp|3\.4|international shipping|qaisi|tonnage|marine/i,
    answer: () => {
      const sg = shippingPost("SG-SHIP");
      const hk = shippingPost("HK-CE");
      const marine = entityCalc("SG-SHIP");
      return {
        role: "assistant",
        text: `Art. 3.4 is Core, not an election. Qualifying International Shipping Income and Qualified Ancillary International Shipping Income (capped at 50% of ISI) are excluded from GloBE if Art. 3.4.5 is met — strategic or commercial management of the ships effectively carried on from the CE’s jurisdiction. Related Covered Taxes come out of the numerator (Art. 4.1.3). Payroll and tangible assets used in that activity come out of SBIE.\n\nSG020 (pass): ISI ${eur(sg.isi)} · ancillary ${eur(sg.ancillary)} · QAISI ${eur(sg.qaisi)} (cap ${eur(sg.ancillaryCap)}) · excess ancillary ${eur(sg.excessAncillary)} stays in GloBE · excluded income ${eur(sg.excludedIncome)} · related tax ${eur(sg.excludedTax)} stripped. GloBE ${marine ? eur(marine.globe) : "n/a"}.\n\nHK001 (fail): Art. 3.4.5 not met — ships managed from Singapore. ISI ${eur(hk.isi)} stays in FANIL. Hong Kong Art. 5.1.2 numbers are unchanged.\n\nSETR_SHIP is a Simplified ETR opt-out only. It does not unwind Core Art. 3.4.\n\nRule OECD-SHIP-34 v2026.1.`,
        cites: [
          { label: "SG020 GloBE income", href: "/globe-income" },
          { label: "OECD-SHIP-34", href: "/rulebook" },
          { label: "Covered taxes", href: "/covered-taxes" },
        ],
      };
    },
  },
  {
    match: /adjustment|810020|dividend/i,
    answer: () => ({
      role: "assistant",
      text: `TH001 excluded dividends $1.84M (account 810020) are subtracted from FANIL under GloBE Model Rules Art. 3.2.1(b) — ownership ≥ 10%, intra-group dividend from MY-CE.\n\nOriginal amount $1.84M · adjustment −$1.84M · preparer N. Chai · reviewer M. Sato · source TH001 Trial Balance FY2026.xlsx · rule OECD-DIV-EXCL v2026.1.\n\nThis is a canonical GloBE adjustment, not an LLM estimate.`,
      cites: [{ label: "OECD-DIV-EXCL v2026.1" }, { label: "TH001 Trial Balance FY2026.xlsx" }],
    }),
  },
  {
    match: /central record|jurisdiction pack|oecd scrape|refresh from oecd/i,
    answer: () => ({
      role: "assistant",
      text: `Jurisdiction packs are taken from the OECD Central Record of legislation with transitional qualified status — not invented by the model.\n\nRefresh from OECD fetches the live Inclusive Framework page, extracts IIR / QDMTT / QDMTT Safe Harbour / SbS listings for countries in this group, and diffs them against the signed Aug 2026 pack.\n\nAI extracts. A reviewer accepts. The engine does not switch collection (QDMTT → IIR → UTPR) until the pack is signed. Absence from the Record is not a finding that the law is unqualified (Vietnam in this demo).\n\nSource: OECD Central Record HTML + PDF.`,
      cites: [
        { label: "OECD Central Record", href: "/jurisdictions" },
        { label: "GMT24 jurisdiction packs", href: "/jurisdictions" },
      ],
    }),
  },
  {
    match: /oecd|basis|rule/i,
    answer: () => ({
      role: "assistant",
      text: `Active rule pack for this snapshot: GMT24 Global Rulebook 2026.2.\n\n• OECD-GloBE-15 — 15% minimum (Commentary 2026)\n• OECD-SCOPE-750 — $750m / 2-of-4 (group presentation USD)\n• OECD-SBIE-2026 — payroll 9.4% / assets 7.4%\n• OECD-TCSH-2026 — Transitional CbCR SH extended to FY beginning on or before 31 Dec 2027; 17% simplified ETR for 2026 and 2027\n• OECD-SETR-SH — Simplified ETR Safe Harbour framework for later years\n• OECD-SBTISH — Substance-based Tax Incentive Safe Harbour\n• OECD-ELEC-2026 — Election & Scenario Engine (scope, 5-year locks, GIR section D)\n• OECD-MOCE-513 — MOCE / MOSG separate ETR (UPE ownership ≤ 30%)
• OECD-POPE-214 — POPE IIR first (outsiders > 20% of a non-UPE Parent)
• OECD-IR-222 — Inclusion Ratio
• OECD-JV-64 — JV Group separate ETR
• OECD-SHIP-34 — Art. 3.4 International Shipping Income exclusion (ISI + 50% QAISI cap; Art. 3.4.5 management test)
• Jurisdictional packs from the OECD Central Record (demo dated 2026-08)\n\nAnswers are retrieved from this pack + the calculation snapshot, not from general model memory.`,
      cites: RULES.slice(0, 6).map((r) => ({ label: `${r.id} ${r.version}` })),
    }),
  },
];

export function answerCopilot(q: string, calcs?: JurCalc[]): CopilotMsg {
  const hit = CANNED.find((c) => c.match.test(q));
  if (hit) return hit.answer(q);
  const list = calcs ?? calculateGroup();
  const named = list.find((j) => q.toLowerCase().includes(j.name.toLowerCase()) || q.toUpperCase().includes(j.iso));
  if (named) {
    return {
      role: "assistant",
      text: `${named.name} (${named.iso}) — FY2026 snapshot.\n\nGloBE income ${eur(named.globeIncome)} · Covered taxes ${eur(named.coveredTax)} · ETR ${pct(named.etr, 2)} · SBIE ${eur(named.sbie)} · Top-up ${eur(named.jurisdictionalTopUp)}.\nCollection: ${named.collection.payer}.\n\n${named.sh.navigator}\n\nData completeness ${named.completeness}%. Engine GMT24-CALC 2026.2.`,
      cites: [{ label: named.pack?.qualified ?? "Rulebook 2026.2" }],
    };
  }
  const gaps = ISSUES.filter((i) => i.severity === "block");
  return {
    role: "assistant",
    text: `I can only answer from the GMT24 calculation snapshot and the approved rulebook.\n\nGroup top-up is ${eur(list.reduce((a, c) => a + c.jurisdictionalTopUp, 0))} across ${list.filter((c) => c.jurisdictionalTopUp > 0).length} jurisdictions.\n\nOpen blockers: ${gaps.map((g) => g.title).join("; ") || "none"}.\n\nTry: “Why is Thailand’s ETR 10.8%?”, “Can Thailand qualify for a safe harbour?”, “What happens if the BOI tax holiday expires?”, “Which data is missing from Singapore?”`,
    cites: [{ label: "GMT24-CALC 2026.2" }],
  };
}

export const SUGGESTIONS = [
  "Optimize my GloBE position",
  "Should Thailand elect Art. 3.2.2 stock compensation?",
  "Where does the OECD calculation diverge from Thai RD Pillar Two requirements?",
  "Who pays the Thai QDMTT and is there residual UTPR?",
  "Should we keep the BOI holiday, convert to 10%, or wait for QRTC?",
  "How much of the Thai BOI holiday survives QDMTT?",
  "Explain deferred tax recast and DTL recapture for Thailand",
  "Which entities caused the reduction?",
  "Can Thailand qualify for a safe harbour?",
  "What happens if the BOI tax holiday expires?",
  "Explain the TH001 dividend adjustment.",
  "Which data is missing from Singapore?",
  "How does the entity test treat MOCE and POPE?",
  "Where is Additional Current Top-up Tax?",
  "Why is Hong Kong top-up 30%?",
  "Does once out, always out bar Thailand next year?",
  "How does evidence history stay immutable?",
  "Show the OECD basis for this treatment.",
];

export function mappingHint(account: string) {
  const row = ACCOUNTS.find((a) => a.account === account);
  if (!row) return null;
  const e = ENTITIES.find((x) => x.id === row.entityId);
  return `${row.account} ${row.name} → ${row.financial} → ${row.globe}${row.adjustment ? ` → ${row.adjustment}` : ""}${row.sbie ? ` → ${row.sbie}` : ""} · confidence ${row.confidence}% · ${e?.name}`;
}
