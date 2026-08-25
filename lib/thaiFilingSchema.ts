import { THAI_PACK } from "./thailand";
import type { JurCalc } from "./engine";

/**
 * Thai s 57 schema-readiness layer.
 * Does NOT invent a Revenue Department electronic schema.
 * Maps GloBE / Decree data into expected filing field families and blocks export until the pack schema exists.
 */

export type SchemaStatus = "ready" | "mapped" | "blocked" | "pending";

export type ThaiFilingField = {
  id: string;
  section: "s54" | "s55-56" | "s57" | "s58" | "admin";
  family: string;
  label: string;
  source: string;
  href: string;
  status: SchemaStatus;
  value?: string;
  blocker?: string;
};

export type ThaiSchemaReadiness = {
  packVersion: string;
  schemaPublished: false;
  schemaId: null;
  exportAllowed: false;
  headline: string;
  fields: ThaiFilingField[];
  readyCount: number;
  mappedCount: number;
  blockedCount: number;
  pendingCount: number;
  blockers: string[];
  note: string;
};

export function thaiSchemaReadiness(th?: JurCalc | null): ThaiSchemaReadiness {
  const payable = th ? Math.round(th.jurisdictionalTopUp) : null;
  const fields: ThaiFilingField[] = [
    {
      id: "F-TAXID",
      section: "admin",
      family: "Identity",
      label: "Thai tax identification number",
      source: "Entity situs · TH001",
      href: "/thailand/entities",
      status: "ready",
      value: "0107558000121",
    },
    {
      id: "F-FY",
      section: "s57",
      family: "Period",
      label: "Fiscal year begin / end",
      source: "Thai pack",
      href: "/thailand",
      status: "ready",
      value: `${THAI_PACK.fyStart} → ${THAI_PACK.fyEnd}`,
    },
    {
      id: "F-SCOPE",
      section: "s54",
      family: "Notification",
      label: "In-scope notification (s 54)",
      source: "Scope memorandum · BOT window",
      href: "/thailand/scope",
      status: "mapped",
      value: "IN SCOPE · first year FY2025",
    },
    {
      id: "F-DESIGNEE",
      section: "s57",
      family: "Filer",
      label: "Designated Thai taxpayer",
      source: "Liability dashboard election",
      href: "/thailand/liability",
      status: "mapped",
      value: "TH001 · Aetherion Thailand Co., Ltd.",
    },
    {
      id: "F-QDMTT",
      section: "s57",
      family: "Amount",
      label: "Thai QDMTT payable",
      source: "Core jurisdictional top-up · TH blend",
      href: "/thailand/liability",
      status: payable === null ? "blocked" : "mapped",
      value: payable === null ? undefined : `USD ${payable.toLocaleString("en-US")}`,
      blocker: payable === null ? "No Thai jurisdictional calculation in snapshot" : undefined,
    },
    {
      id: "F-SBIE",
      section: "s57",
      family: "Computation",
      label: "Thai SBIE (Notification No. 4 / MOF No. 1)",
      source: "Thai SBIE engine",
      href: "/thailand/sbie",
      status: "mapped",
      value: "Line-level payroll / assets ready",
    },
    {
      id: "F-GIR-X",
      section: "s55-56",
      family: "Exchange",
      label: "CAA / local GIR relief",
      source: "Filing command · Japan UPE exchange review",
      href: "/thailand/filing",
      status: "mapped",
      value: "Review before relying on exemption",
    },
    {
      id: "F-OECD-GIR",
      section: "s55-56",
      family: "Exchange",
      label: "OECD GIR XML (not the Thai return)",
      source: "GIR Autopilot",
      href: "/gir",
      status: "mapped",
      value: "Separate from s 57",
    },
    {
      id: "F-S31",
      section: "s57",
      family: "Computation",
      label: "Section 31 GloBE income adjustments",
      source: "Delegated instrument",
      href: "/thailand/gap",
      status: "pending",
      blocker: "Decree s 31 secondary instrument not in pack",
    },
    {
      id: "F-S33",
      section: "s57",
      family: "Computation",
      label: "Section 33 Adjusted Covered Taxes",
      source: "Delegated instrument",
      href: "/thailand/gap",
      status: "pending",
      blocker: "Decree s 33 secondary instrument not in pack",
    },
    {
      id: "F-SCHEMA",
      section: "s57",
      family: "Electronic form",
      label: "RD electronic form / XML schema (ss 53–57)",
      source: THAI_PACK.coverage.headline,
      href: "/thailand/filing",
      status: "blocked",
      blocker: "Revenue Department e-filing schema not published in this pack — export disabled",
    },
    {
      id: "F-RECEIPT",
      section: "s57",
      family: "Payment",
      label: "Payment / receipt locker",
      source: "Approvals · maker-checker",
      href: "/approvals",
      status: "blocked",
      blocker: "No e-filing receipt channel until schema exists",
    },
  ];

  const readyCount = fields.filter((f) => f.status === "ready").length;
  const mappedCount = fields.filter((f) => f.status === "mapped").length;
  const blockedCount = fields.filter((f) => f.status === "blocked").length;
  const pendingCount = fields.filter((f) => f.status === "pending").length;
  const blockers = fields.filter((f) => f.blocker).map((f) => f.blocker!);

  return {
    packVersion: THAI_PACK.version,
    schemaPublished: false,
    schemaId: null,
    exportAllowed: false,
    headline: "Thai s 57 return — schema readiness only · export gated",
    fields,
    readyCount,
    mappedCount,
    blockedCount,
    pendingCount,
    blockers,
    note: "GMT24 maps Decree / Notification data into expected filing field families. It will not generate a Thai return XML until the RD electronic schema is added to the jurisdiction pack.",
  };
}

export function assertThaiExportBlocked(): never {
  throw new Error("Thai s 57 electronic schema is pending — export is blocked by design.");
}
