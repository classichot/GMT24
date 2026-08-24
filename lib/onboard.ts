import { FIRM, GROUPS, JURISDICTION_PACKS, type Group } from "./model";

export const ENGAGEMENT_KEY = "gmt24_engagements";

export type EngagementDraft = {
  name: string;
  upe: string;
  upeIso: string;
  upeTin: string;
  fy: string;
  fyStart: string;
  fyEnd: string;
  rev23: string;
  rev24: string;
  rev25: string;
  rev26: string;
  partner: string;
  clientLead: string;
};

export const EMPTY_DRAFT: EngagementDraft = {
  name: "",
  upe: "",
  upeIso: "SG",
  upeTin: "",
  fy: "FY2026",
  fyStart: "2026-01-01",
  fyEnd: "2026-12-31",
  rev23: "",
  rev24: "",
  rev25: "",
  rev26: "",
  partner: FIRM,
  clientLead: "",
};

export const ONBOARD_STEPS = [
  {
    n: "01",
    id: "identity",
    href: "/onboard",
    title: "Group identity",
    do: "MNE legal name, UPE, UPE jurisdiction, identification number.",
  },
  {
    n: "02",
    id: "year",
    href: "/onboard",
    title: "Fiscal year",
    do: "Reporting Fiscal Year and accounting period for the GIR.",
  },
  {
    n: "03",
    id: "scope",
    href: "/onboard",
    title: "€750m window",
    do: "Consolidated revenue for the last four years. In scope if two years meet $750m.",
  },
  {
    n: "04",
    id: "people",
    href: "/onboard",
    title: "Engagement desk",
    do: "Firm partner and client tax lead. Advisor signs; client remains the preparer.",
  },
  {
    n: "05",
    id: "pack",
    href: "/data",
    title: "Close pack",
    do: "Drop entity list, consolidation, tax provision, CbCR, deferred tax, payroll.",
  },
  {
    n: "06",
    id: "map",
    href: "/mapping",
    title: "Account mapping",
    do: "Accept or retag AI mappings. Human approval before the engine uses a map.",
  },
  {
    n: "07",
    id: "test",
    href: "/entities",
    title: "Entity test",
    do: "CE, MOCE, POPE, JV Group. Classification from the ownership chain.",
  },
  {
    n: "08",
    id: "calc",
    href: "/overview",
    title: "Calculate & GIR",
    do: "Deterministic ETR, QDMTT / IIR / UTPR, then GIR pack. AI never posts the number.",
  },
] as const;

export const PACK_DOCS = [
  { kind: "Legal entity list", level: "required" as const, need: "UPE, CEs, PEs, JVs, ownership %, GAAP, acquisition date." },
  { kind: "Consolidation", level: "required" as const, need: "FANIL by entity in the UPE presentation currency." },
  { kind: "Trial balance", level: "required" as const, need: "Local TB mapped to GloBE income and Covered Taxes." },
  { kind: "Tax provision", level: "required" as const, need: "Current tax, deferred tax, uncertain tax treatments." },
  { kind: "CbCR", level: "required" as const, need: "Transitional CbCR Safe Harbour and revenue reconciliation." },
  { kind: "Deferred tax", level: "recommended" as const, need: "DTA/DTL roll-forward for Art. 4.4 recast and recapture." },
  { kind: "Payroll / tangible assets", level: "recommended" as const, need: "SBIE eligible payroll and carrying value of tangible assets." },
  { kind: "Prior GIR", level: "recommended" as const, need: "Carried elections, Art. 4.5 bar, prior-year compare." },
  { kind: "Incentive certificates", level: "if-needed" as const, need: "BOI / DEI / IP boxes — only if claimed." },
];

let extraCache: Group[] = [];

export function setExtraGroups(rows: Group[]) {
  extraCache = rows;
}

export function extraGroups() {
  return extraCache;
}

export function portfolio() {
  return [...GROUPS, ...extraCache];
}

export function findGroup(id: string) {
  return portfolio().find((g) => g.id === id) ?? GROUPS[0];
}

export function slugEngagement(name: string, taken: string[]) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) || "client";
  let id = base;
  let n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

export function millionsToUsd(raw: string) {
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1_000_000);
}

export function parseStoredGroups(raw: string | null): Group[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is Group => {
      if (!x || typeof x !== "object") return false;
      const r = x as Group;
      return typeof r.id === "string" && typeof r.name === "string" && typeof r.upe === "string" && Array.isArray(r.revenueHistory);
    });
  } catch {
    return [];
  }
}

export function allGroupIds(extra: Group[]) {
  return [...GROUPS, ...extra].map((g) => g.id);
}

export function nameTaken(name: string, extra: Group[]) {
  const n = name.trim().toLowerCase();
  return [...GROUPS, ...extra].some((g) => g.name.trim().toLowerCase() === n);
}

export function fyYear(fy: string) {
  const m = fy.match(/(\d{4})/);
  return m ? Number(m[1]) : 2026;
}

export function draftToGroup(draft: EngagementDraft, extra: Group[]): Group {
  const y = fyYear(draft.fy);
  const history = [
    { fy: `FY${y - 3}`, amount: millionsToUsd(draft.rev23) },
    { fy: `FY${y - 2}`, amount: millionsToUsd(draft.rev24) },
    { fy: `FY${y - 1}`, amount: millionsToUsd(draft.rev25) },
    { fy: draft.fy.trim() || `FY${y}`, amount: millionsToUsd(draft.rev26) },
  ];
  const pack = JURISDICTION_PACKS.find((p) => p.iso === draft.upeIso);
  return {
    id: slugEngagement(draft.name, allGroupIds(extra)),
    name: draft.name.trim(),
    upe: draft.upe.trim() || `${draft.name.trim()} Holdings`,
    upeIso: pack?.iso ?? draft.upeIso,
    fy: draft.fy.trim() || `FY${y}`,
    fyStart: draft.fyStart.trim() || `${y}-01-01`,
    fyEnd: draft.fyEnd.trim() || `${y}-12-31`,
    currency: "USD",
    revenueHistory: history,
    entities: 0,
    jurisdictions: 0,
    workflow: "Imported",
    advisor: (draft.partner.trim() || FIRM),
    custom: true,
    upeTin: draft.upeTin.trim() || undefined,
  };
}
