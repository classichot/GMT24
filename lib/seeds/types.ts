import type { AccountMap, Adjustment, Entity, Filing, Financials, Group, Incentive, Issue, SourceFile } from "../model";

/** Rule status of one jurisdiction as signed into the demo pack table. */
export type JurisdictionPack = {
  iso: string;
  name: string;
  iir: boolean;
  qdmtt: boolean;
  qdmttSH: boolean;
  utpr: boolean;
  from: string;
  qualified: string;
  filing: string;
  fx: string;
  notes: string;
};

export type SeedUser = { name: string; role: string; initials: string; email: string; org: string };

/**
 * One complete teaching group: master data, financials, working papers and
 * the demo-door metadata. The engine, X-Ray, Thailand pack and Co-Pilot all
 * read whichever seed is active — nothing in them is tied to a single group.
 */
export type GroupSeed = {
  id: string;
  group: Group;
  inhouseUser: SeedUser;
  entities: Entity[];
  financials: Financials[];
  adjustments: Adjustment[];
  accounts: AccountMap[];
  files: SourceFile[];
  issues: Issue[];
  incentives: Incentive[];
  filings: Filing[];
  packs: JurisdictionPack[];
  girSections: { id: string; title: string; status: string; fields: number; missing: number }[];
  activity: { text: string; who: string; when: string }[];
  forecast: { period: string; topUp: number }[];
  demo: {
    /** Shown on the review-link door and Host desk. */
    label: string;
    /** One line on what this group teaches. */
    story: string;
    loginEmail: string;
    entityListFile: string;
    packName: string;
    /** Sample CSVs offered on Data Hub and the Review guide. */
    samples: { name: string; href: string; kind: string; note: string }[];
  };
};
