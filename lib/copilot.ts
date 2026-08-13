import { ACCOUNTS, ENTITIES, INCENTIVES, ISSUES, RULES } from "./model";
import { calculateGroup, calcForIso, type JurCalc } from "./engine";
import { eur, pct } from "./format";

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
    match: /boi|holiday|expire/i,
    answer: () => {
      const inc = INCENTIVES.find((i) => i.id === "TH-BOI")!;
      return {
        role: "assistant",
        text: `The Thai BOI certificate (${inc.name}) runs ${inc.start} → ${inc.end}: ${inc.rate}.\n\nIf the holiday expires or is not extended, current tax in Thailand rises toward the 20% CIT. In the Simulator, extending BOI through 2031 keeps FY2027 top-up near the current ${eur(th().jurisdictionalTopUp)}; letting it expire increases Thai covered taxes and can eliminate Thai top-up while shifting residual exposure depending on blending.\n\nSBTISH may still be relevant for remaining reduced-rate years. GMT24 will not let the model hallucinate the CIT computation — the engine re-runs from mapped tax expense.\n\nSource: ${inc.extractedFrom} · rule OECD-SBTISH v2026.2.`,
        cites: [{ label: inc.extractedFrom }, { label: "OECD-SBTISH v2026.2" }],
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
      text: `Active rule pack for this snapshot: GMT24 Global Rulebook 2026.2.\n\n• OECD-GloBE-15 — 15% minimum (Commentary 2026)\n• OECD-SCOPE-750 — $750m / 2-of-4 (group presentation USD)\n• OECD-SBIE-2026 — payroll 9.4% / assets 7.4%\n• OECD-TCSH-2026 — Transitional CbCR SH extended to FY beginning on or before 31 Dec 2027; 17% simplified ETR for 2026 and 2027\n• OECD-SETR-SH — Simplified ETR Safe Harbour framework for later years\n• OECD-SBTISH — Substance-based Tax Incentive Safe Harbour\n• Jurisdictional packs from the OECD Central Record (demo dated 2026-08)\n\nAnswers are retrieved from this pack + the calculation snapshot, not from general model memory.`,
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
  "Why is Thailand's ETR 10.8%?",
  "Which entities caused the reduction?",
  "Can Thailand qualify for a safe harbour?",
  "What happens if the BOI tax holiday expires?",
  "Explain the TH001 dividend adjustment.",
  "Which data is missing from Singapore?",
  "Show the OECD basis for this treatment.",
];

export function mappingHint(account: string) {
  const row = ACCOUNTS.find((a) => a.account === account);
  if (!row) return null;
  const e = ENTITIES.find((x) => x.id === row.entityId);
  return `${row.account} ${row.name} → ${row.financial} → ${row.globe}${row.adjustment ? ` → ${row.adjustment}` : ""}${row.sbie ? ` → ${row.sbie}` : ""} · confidence ${row.confidence}% · ${e?.name}`;
}
