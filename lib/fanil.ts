import { money } from "./format";
import { ACCOUNTS, ADJUSTMENTS, type Adjustment } from "./model";

export type MappingPosting = Adjustment & {
  article: string;
  mappingAccount: string;
  autoApproved: boolean;
};

const POSTING_FACTS: Omit<MappingPosting, "autoApproved">[] = [
  {
    id: "MAP-TH-PENSION",
    entityId: "TH-CE",
    category: "Accrued pension expense",
    original: 900_000,
    amount: 250_000,
    article: "Art. 3.2.3",
    mappingAccount: "610030",
    account: "610030",
    reason: "Replace FANIL pension expense $0.90M with qualifying contributions paid $0.65M.",
    ruleId: "OECD-GloBE-15",
    sourceDoc: "Payroll_TH_FY2026.csv",
    preparer: "N. Chai",
    reviewer: null,
    status: "Prepared",
  },
  {
    id: "MAP-SG-ALP",
    entityId: "SG-HC",
    category: "Arm's-length adjustment",
    original: 540_000,
    amount: 180_000,
    article: "Art. 3.2.4",
    mappingAccount: "640500",
    account: "640500",
    reason: "Increase same-group cross-border service charge to the arm's-length amount consistently in both counterpart jurisdictions.",
    ruleId: "OECD-GloBE-15",
    sourceDoc: "TP_Master_File_2026.pdf",
    preparer: "L. Tan",
    reviewer: "M. Sato",
    status: "Reviewed",
  },
  {
    id: "MAP-TH-PE-OUT",
    entityId: "TH-CE",
    category: "PE FANIL allocation — Main Entity",
    original: 300_000,
    amount: -300_000,
    article: "Art. 3.5",
    mappingAccount: "390100",
    account: "390100",
    reason: "Remove Rayong PE result from the Main Entity after the Art. 3.5 separate-accounts allocation.",
    ruleId: "OECD-GloBE-15",
    sourceDoc: "TH001 PE allocation workbook FY2026.xlsx",
    preparer: "N. Chai",
    reviewer: "M. Sato",
    status: "Reviewed",
  },
  {
    id: "MAP-TH-PE-IN",
    entityId: "TH-PE",
    category: "PE FANIL allocation — Permanent Establishment",
    original: 300_000,
    amount: 300_000,
    article: "Art. 3.5",
    mappingAccount: "390100",
    account: "390100",
    reason: "Post the Rayong PE result to the PE under the applicable treaty / domestic allocation method.",
    ruleId: "OECD-GloBE-15",
    sourceDoc: "TH001 PE allocation workbook FY2026.xlsx",
    preparer: "N. Chai",
    reviewer: "M. Sato",
    status: "Reviewed",
  },
  {
    id: "MAP-JP-INS",
    entityId: "JP-UPE",
    category: "Policyholder tax charge",
    original: 120_000,
    amount: -120_000,
    article: "Art. 3.2.9",
    mappingAccount: "715500",
    account: "715500",
    reason: "Exclude tax charged to policyholders and paid by the captive insurance programme where included in FANIL.",
    ruleId: "OECD-GloBE-15",
    sourceDoc: "JP captive insurance reconciliation FY2026.xlsx",
    preparer: "Group Tax",
    reviewer: "M. Sato",
    status: "Reviewed",
  },
];

export function mappedPostings(approvedMaps: Record<string, boolean> = {}): MappingPosting[] {
  return POSTING_FACTS.map((fact) => {
    const map = ACCOUNTS.find(
      (a) => a.account === fact.mappingAccount
        && (a.entityId === fact.entityId || fact.mappingAccount === "390100"),
    );
    return { ...fact, autoApproved: Boolean(map?.approved) };
  }).filter((fact) => fact.autoApproved || approvedMaps[fact.mappingAccount]);
}

export function availableMappingPostings() {
  return POSTING_FACTS.map((fact) => {
    const map = ACCOUNTS.find(
      (a) => a.account === fact.mappingAccount
        && (a.entityId === fact.entityId || fact.mappingAccount === "390100"),
    );
    return { ...fact, autoApproved: Boolean(map?.approved) };
  });
}

export function entityAdjustments(entityId: string, approvedMaps: Record<string, boolean> = {}) {
  return [
    ...ADJUSTMENTS.filter((a) => a.entityId === entityId),
    ...mappedPostings(approvedMaps).filter((a) => a.entityId === entityId),
  ];
}

export function mappingDelta(account: string, approvedMaps: Record<string, boolean> = {}) {
  return money(
    mappedPostings(approvedMaps)
      .filter((p) => p.mappingAccount === account)
      .reduce((sum, p) => sum + p.amount, 0),
  );
}
