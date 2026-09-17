import type { Issue, SourceFile } from "./model";

export type DocNeed = "required" | "recommended";
export type SlotStatus = "posted" | "queued" | "incomplete" | "missing";

export type DatasetSlot = {
  id: string;
  title: string;
  kind: string;
  need: DocNeed;
  why: string;
  oecd: string;
  href: string;
  /** Extra tokens matched against a file name (kind is also matched). */
  matchers: string[];
  /** DATA.issues.area values that mark this slot incomplete even when a file is posted. */
  issueAreas?: string[];
};

export type SlotReview = {
  slot: DatasetSlot;
  status: SlotStatus;
  files: string[];
  issues: Issue[];
  note: string;
};

export type DatasetReview = {
  items: SlotReview[];
  required: { total: number; posted: number; incomplete: number; queued: number; missing: number };
  recommended: { total: number; posted: number; incomplete: number; queued: number; missing: number };
  /** 0–100. Required slots weigh twice recommended. Incomplete counts as half. */
  completion: number;
  canCalculate: boolean;
  headline: string;
  suggestion: string;
  nextDrops: { title: string; why: string; need: DocNeed }[];
};

/**
 * Documents GMT24 needs to calculate GloBE and to overlay Thai RD.
 * Required = the engine cannot post a defendable ETR / SBIE / top-up without them.
 * Recommended = quality, harbour, incentive and filing overlays.
 */
export const DATASET_SLOTS: DatasetSlot[] = [
  {
    id: "entity-list",
    title: "Legal entity list",
    kind: "Legal entity list",
    need: "required",
    why: "Locks the MNE perimeter, UPE, ownership and entity tests (CE / PE / JV / MOCE / POPE) before any blend is calculated.",
    oecd: "Art. 1.2 / 10.1",
    href: "/entities",
    matchers: ["legal entity", "entity list", "lelist", "shareholder register", "ownership"],
  },
  {
    id: "consolidation",
    title: "Consolidation / UPE CFS",
    kind: "Consolidation",
    need: "required",
    why: "FANIL and the Art. 1.1 €750m window come from the UPE consolidated statements, not local books.",
    oecd: "Art. 1.1 / 3.1",
    href: "/group",
    matchers: ["consol", "cfs", "consolidation", "group pack"],
  },
  {
    id: "trial-balance",
    title: "Trial balances",
    kind: "Trial balance",
    need: "required",
    why: "Entity FANIL and the Art. 3.2 bridge start from the trial balance (or the mapped TB extract).",
    oecd: "Art. 3.1",
    href: "/globe-income",
    matchers: ["trial balance", "trial_balance", " tb ", "tb_", "_tb", "tb fy"],
  },
  {
    id: "tax-provision",
    title: "Tax provision",
    kind: "Tax provision",
    need: "required",
    why: "Current covered taxes in the ETR numerator. Without it the engine cannot post Adjusted Covered Taxes.",
    oecd: "Art. 4.1",
    href: "/covered-taxes",
    matchers: ["tax provision", "provision", "cit computation", "current tax"],
  },
  {
    id: "deferred-tax",
    title: "Deferred-tax roll-forward",
    kind: "Deferred tax",
    need: "required",
    why: "Art. 4.4 recast at 15% and the five-year DTL recapture clock. Opening DTA/DTL must be in the register.",
    oecd: "Art. 4.4",
    href: "/deferred-tax",
    matchers: ["deferred tax", "dta", "dtl", "rollforward", "roll-forward"],
    issueAreas: ["Deferred tax", "Covered tax"],
  },
  {
    id: "cbcr",
    title: "Country-by-Country Report",
    kind: "CbCR",
    need: "required",
    why: "Transitional CbCR safe harbour and the GIR / CbCR vs GloBE bridge. Simplified ETR uses CbCR tax ÷ profit.",
    oecd: "Art. 8.1 / TCSH",
    href: "/safe-harbours",
    matchers: ["cbcr", "country-by-country", "country by country"],
    issueAreas: ["CbCR"],
  },
  {
    id: "payroll",
    title: "Payroll / eligible employees",
    kind: "Payroll",
    need: "required",
    why: "SBIE payroll carve-out (FY2026 9.4%). Thai Notification No. 4 needs the line-level file, not a single total.",
    oecd: "Art. 5.3 / 9.2",
    href: "/sbie",
    matchers: ["payroll", "fte", "employee listing", "headcount"],
    issueAreas: ["SBIE"],
  },
  {
    id: "far",
    title: "Fixed-asset register",
    kind: "Fixed-asset register",
    need: "required",
    why: "SBIE tangible-asset carve-out (FY2026 7.4%). Average carrying value; revaluation uplift is out.",
    oecd: "Art. 5.3 / 9.2",
    href: "/sbie",
    matchers: ["fixed-asset", "fixed asset", "far", "ppe register", "asset register"],
  },
  {
    id: "incentives",
    title: "Incentive certificates",
    kind: "Incentive certificate",
    need: "recommended",
    why: "BOI / DEI / IP-box / holiday certificates. Needed to explain a low ETR and to run the BOI Optimizer / SBTISH screen.",
    oecd: "SBTISH / Art. 5.1",
    href: "/incentives",
    matchers: ["boi", "incentive", "holiday", "gtp", "hnte", "eit", "kdb", "edb"],
  },
  {
    id: "tp",
    title: "Transfer-pricing report",
    kind: "TP report",
    need: "recommended",
    why: "Supports related-party FANIL and Art. 3.2 adjustments. Not a GloBE input by itself — defence evidence.",
    oecd: "Art. 3.2",
    href: "/globe-income",
    matchers: ["tp report", "transfer pric", "master file", "local file"],
  },
  {
    id: "prior-gir",
    title: "Prior-year GIR",
    kind: "Previous GIR",
    need: "recommended",
    why: "Carries five-year elections, Art. 4.5 GloBE Loss and ‘once out, always out’ harbour history into this year.",
    oecd: "GIR / Art. 9.1",
    href: "/gir",
    matchers: ["gir", "globe information"],
  },
  {
    id: "pe",
    title: "PE allocation workbook",
    kind: "PE allocation",
    need: "recommended",
    why: "Splits PE TB and FAR from the main entity so the PE is located and blended correctly.",
    oecd: "Art. 10.3",
    href: "/thailand/entities",
    matchers: ["pe allocation", "permanent establishment", "pe tb"],
  },
  {
    id: "covered-alloc",
    title: "Covered-tax allocation",
    kind: "Covered-tax allocation",
    need: "recommended",
    why: "WHT, CFC inclusions and cross-border covered-tax pushes (Art. 4.3) that do not sit on the local provision.",
    oecd: "Art. 4.3",
    href: "/covered-taxes",
    matchers: ["wht", "cfc", "covered-tax", "covered tax", "withholding"],
  },
  {
    id: "tax-return",
    title: "Local CIT / tax return",
    kind: "Tax return",
    need: "recommended",
    why: "Reconciles the provision to the filed return. Not the GIR and not the Thai s 57 return.",
    oecd: "Art. 4.1",
    href: "/covered-taxes",
    matchers: ["tax return", "cit return", "pnd", "corporate income tax return"],
  },
  {
    id: "fx",
    title: "Locked FX / BOT rates",
    kind: "FX rates",
    need: "recommended",
    why: "Presentation FX for Core; Thai Notification No. 6 BOT midpoints for the THB scope and payment tests.",
    oecd: "Art. 3.1.3 · DG Not. 6",
    href: "/thailand/fx",
    matchers: ["bot", "fx rate", "exchange rate", "midpoint"],
  },
  {
    id: "globe-adj",
    title: "GloBE adjustment workpapers",
    kind: "GloBE adjustment",
    need: "recommended",
    why: "Excluded dividends, stock-comp, shipping, insurance and other Art. 3.2 / 3.4 support that is not on the TB face.",
    oecd: "Art. 3.2 / 3.4",
    href: "/globe-income",
    matchers: ["globe adjustment", "art. 3.2", "excluded dividend", "shipping"],
  },
];

const KIND_ALIASES: Record<string, string[]> = {
  "BOI certificate": ["incentives"],
  "Incentive certificate": ["incentives"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/[_-]+/g, " ");
}

export function slotForKind(kind: string): DatasetSlot | undefined {
  const aliasIds = KIND_ALIASES[kind];
  if (aliasIds) return DATASET_SLOTS.find((s) => aliasIds.includes(s.id));
  return DATASET_SLOTS.find((s) => s.kind.toLowerCase() === kind.toLowerCase());
}

export function slotForName(name: string): DatasetSlot | undefined {
  const n = ` ${norm(name)} `;
  let hit: DatasetSlot | undefined;
  let score = 0;
  for (const slot of DATASET_SLOTS) {
    const tokens = [slot.kind, ...slot.matchers].map(norm);
    const s = tokens.reduce((a, t) => (t && n.includes(` ${t} `) || n.includes(t) ? a + t.length : a), 0);
    if (s > score) {
      score = s;
      hit = slot;
    }
  }
  return score > 0 ? hit : undefined;
}

/** Classifier used by the dropzone — same tokens as the guideline. */
export function classifyDatasetName(name: string): string {
  return slotForName(name)?.kind ?? "Source file";
}

function tally(items: SlotReview[], need: DocNeed) {
  const rows = items.filter((i) => i.slot.need === need);
  return {
    total: rows.length,
    posted: rows.filter((i) => i.status === "posted").length,
    incomplete: rows.filter((i) => i.status === "incomplete").length,
    queued: rows.filter((i) => i.status === "queued").length,
    missing: rows.filter((i) => i.status === "missing").length,
  };
}

function slotIssues(slot: DatasetSlot, issues: Issue[]): Issue[] {
  if (!slot.issueAreas?.length) return [];
  return issues.filter((i) => {
    if (i.severity === "info") return false;
    if (!slot.issueAreas!.includes(i.area)) return false;
    if (slot.id === "deferred-tax" && i.area === "Covered tax") {
      return /dta|dtl|deferred/i.test(`${i.title} ${i.detail}`);
    }
    if (slot.id === "payroll" && i.area === "SBIE") {
      return /payroll|employee|fte|headcount/i.test(`${i.title} ${i.detail}`);
    }
    return true;
  });
}

function noteFor(status: SlotStatus, files: string[], issues: Issue[], slot: DatasetSlot): string {
  if (status === "missing") return `Not on file. Needed to ${slot.why.charAt(0).toLowerCase()}${slot.why.slice(1)}`;
  if (status === "queued") return `Dropped, not posted: ${files.join(", ")}. Load or approve the pack before the engine uses it.`;
  if (status === "incomplete") {
    const gap = issues[0];
    return `${files[0] ?? slot.kind} is posted, but ${gap ? `${gap.title} (${gap.id})` : "a quality issue"} is still open.`;
  }
  return files.length > 1 ? `${files.length} files posted.` : `${files[0]} posted.`;
}

export function reviewDataset(posted: SourceFile[] | null, queued: string[], issues: Issue[]): DatasetReview {
  const files = posted ?? [];
  const items: SlotReview[] = DATASET_SLOTS.map((slot) => {
    const matchedFiles = files.filter((f) => slotForKind(f.kind)?.id === slot.id || slotForName(f.name)?.id === slot.id);
    const matchedQueued = queued.filter((n) => slotForName(n)?.id === slot.id);
    const flags = slotIssues(slot, issues);
    const names = [...new Set([...matchedFiles.map((f) => f.name), ...matchedQueued])];
    let status: SlotStatus = "missing";
    if (matchedFiles.length && flags.length) status = "incomplete";
    else if (matchedFiles.length) status = "posted";
    else if (matchedQueued.length) status = "queued";
    return { slot, status, files: names, issues: flags, note: noteFor(status, names, flags, slot) };
  });

  const required = tally(items, "required");
  const recommended = tally(items, "recommended");

  const weight = (r: SlotReview) => {
    const w = r.slot.need === "required" ? 2 : 1;
    if (r.status === "posted") return w;
    if (r.status === "incomplete") return w * 0.5;
    if (r.status === "queued") return w * 0.25;
    return 0;
  };
  const max = DATASET_SLOTS.reduce((a, s) => a + (s.need === "required" ? 2 : 1), 0);
  const completion = Math.round((items.reduce((a, r) => a + weight(r), 0) / max) * 100);
  const canCalculate = required.missing === 0 && required.queued === 0;

  const missingReq = items.filter((i) => i.slot.need === "required" && (i.status === "missing" || i.status === "queued"));
  const incomplete = items.filter((i) => i.status === "incomplete");
  const missingRec = items.filter((i) => i.slot.need === "recommended" && i.status === "missing");

  let headline: string;
  if (!posted) {
    headline = `${required.total} required sources to calculate · ${recommended.total} recommended overlays · pack not posted`;
  } else if (canCalculate && incomplete.length === 0) {
    headline = `Required close pack is posted · ${missingRec.length} recommended still open`;
  } else if (canCalculate) {
    headline = `Can calculate · ${incomplete.length} posted source${incomplete.length === 1 ? "" : "s"} still incomplete`;
  } else {
    headline = `${required.missing + required.queued} required source${required.missing + required.queued === 1 ? "" : "s"} still to add before a defendable calc`;
  }

  const nextDrops = [...missingReq, ...incomplete, ...missingRec]
    .slice(0, 6)
    .map((i) => ({ title: i.slot.title, why: i.slot.why, need: i.slot.need }));

  const suggestion = buildSuggestion({ posted, canCalculate, missingReq, incomplete, missingRec, required, completion, issues });

  return { items, required, recommended, completion, canCalculate, headline, suggestion, nextDrops };
}

function buildSuggestion(p: {
  posted: SourceFile[] | null;
  canCalculate: boolean;
  missingReq: SlotReview[];
  incomplete: SlotReview[];
  missingRec: SlotReview[];
  required: DatasetReview["required"];
  completion: number;
  issues: Issue[];
}): string {
  const lines: string[] = [];
  if (!p.posted) {
    lines.push(`No close pack is posted. Drop the ${p.required.total} required sources first — entity list, consolidation, trial balances, tax provision, deferred-tax roll-forward, CbCR, payroll and the fixed-asset register — or load the demo pack.`);
  } else if (!p.canCalculate) {
    lines.push(`Do not lock a GloBE file yet. Still missing or only queued: ${p.missingReq.map((i) => i.slot.title).join(", ")}.`);
  } else {
    lines.push("The required calculation sources are on file. The engine can post ETR, SBIE and top-up from this pack.");
  }
  if (p.incomplete.length) {
    lines.push(
      `Posted but incomplete: ${p.incomplete
        .map((i) => {
          const g = i.issues[0];
          return `${i.slot.title}${g ? ` — ${g.title} (${g.jurisdiction ?? g.entity ?? g.id})` : ""}`;
        })
        .join("; ")}. GMT24 will not invent the missing months, opening balances or site split.`,
    );
  }
  if (p.missingRec.length && p.canCalculate) {
    lines.push(`Recommended next: ${p.missingRec.slice(0, 4).map((i) => i.slot.title).join(", ")}. These do not stop the Core calc; they support harbours, incentives, PE blending and the filing trail.`);
  }
  const mapping = p.issues.filter((i) => i.area === "Mapping" && i.severity !== "info");
  if (mapping.length) {
    lines.push(`Mapping hold (not a missing file): ${mapping.map((i) => i.title).join("; ")}. Approve on Account mapping before lock.`);
  }
  lines.push(`Dataset completion ${p.completion}%. Required slots weigh twice recommended; an incomplete file counts as half.`);
  return lines.join(" ");
}
