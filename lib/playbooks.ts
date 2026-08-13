export type PlayStep = {
  n: string;
  title: string;
  body: string;
  href: string;
  hrefLabel: string;
};

export type Playbook = {
  slug: string;
  menu: string;
  title: string;
  summary: string;
  owner: string;
  steps: PlayStep[];
};

export const PLAYBOOKS: Playbook[] = [
  {
    slug: "overview",
    menu: "Overview",
    title: "Global exposure playbook",
    summary: "Open the year, read group top-up, and drill only where the engine shows exposure.",
    owner: "Group Tax / engagement lead",
    steps: [
      { n: "01", title: "Read the group number", body: "Confirm FY, rule pack and snapshot on the global dashboard. Click the top-up amount to open the audit trail.", href: "/overview", hrefLabel: "Dashboard" },
      { n: "02", title: "Locate low-ETR jurisdictions", body: "Use the ETR map. Violet diamonds are top-up. Blue diamonds are harbour / no exposure.", href: "/etr-map", hrefLabel: "ETR map" },
      { n: "03", title: "See who pays", body: "Open top-up exposure, then allocation, before anyone drafts a GIR.", href: "/exposure", hrefLabel: "Top-up exposure" },
    ],
  },
  {
    slug: "group",
    menu: "Group",
    title: "Group structure playbook",
    summary: "Lock the UPE, ownership graph and constituent-entity list before any GloBE blending.",
    owner: "Group Tax / legal entity control",
    steps: [
      { n: "01", title: "Confirm the tenant", body: "Advisor mode: pick the client first. In-house: Aetherion is the working group.", href: "/clients", hrefLabel: "Clients" },
      { n: "02", title: "Run the $750m test", body: "Scope must be IN SCOPE (or documented REVIEW) before mapping starts.", href: "/group", hrefLabel: "Group structure" },
      { n: "03", title: "Walk entities into ETR", body: "Open an entity row to land on that jurisdiction’s ETR. Use the ownership graph for PE / JV questions.", href: "/entities", hrefLabel: "Entities" },
    ],
  },
  {
    slug: "data",
    menu: "Data",
    title: "Data engine playbook",
    summary: "Ingest → map → validate → request gaps. The LLM never posts a GloBE number.",
    owner: "Local tax / data steward",
    steps: [
      { n: "01", title: "Ingest source files", body: "Trial balance, provision, CbCR, payroll, FAR, BOI certificates. Dropzone opens mapping in this prototype.", href: "/data", hrefLabel: "Data Hub" },
      { n: "02", title: "Approve AI mapping", body: "Account → financial → GloBE → covered tax → SBIE. Hold anything under 80% confidence.", href: "/mapping", hrefLabel: "Account mapping" },
      { n: "03", title: "Clear blockers", body: "Readiness must move before lock. Gap Hunter drafts the request; do not invent deferred tax or payroll.", href: "/quality", hrefLabel: "Data quality" },
    ],
  },
  {
    slug: "pillar-two",
    menu: "Pillar Two",
    title: "Pillar Two calculation playbook",
    summary: "FANIL → GloBE income → covered taxes → ETR → SBIE → top-up → QDMTT / IIR / UTPR. Engine only.",
    owner: "Preparer, then reviewer",
    steps: [
      { n: "01", title: "Confirm scope & harbours", body: "Do not compute a full GloBE file if a transitional harbour already takes the jurisdiction out.", href: "/scope", hrefLabel: "Scope" },
      { n: "02", title: "Build the ETR", body: "GloBE income waterfall, then covered taxes, then jurisdictional ETR. Click amounts for the ledger trail.", href: "/etr", hrefLabel: "ETR" },
      { n: "03", title: "Top-up and collection", body: "SBIE, excess, top-up tax, then who pays — QDMTT first, residual IIR, then UTPR.", href: "/top-up", hrefLabel: "Top-up tax" },
    ],
  },
  {
    slug: "incentives",
    menu: "Incentives",
    title: "Tax incentive playbook",
    summary: "Extract the certificate, decide SBTISH, then simulate expiry in the engine — not in the copilot.",
    owner: "Local tax + Group Tax",
    steps: [
      { n: "01", title: "Inventory incentives", body: "BOI, DEI, KDB, development allowances. Record rate, dates, conditions and source PDF.", href: "/incentives", hrefLabel: "Tax incentives" },
      { n: "02", title: "SBTISH screen", body: "IP boxes (e.g. Irish KDB) are not substance-based. Only substance-conditioned holidays go to SBTISH review.", href: "/safe-harbours", hrefLabel: "Safe harbours" },
      { n: "03", title: "Simulate expiry", body: "Open the simulator with BOI extended / expired and read the live group top-up.", href: "/simulator", hrefLabel: "Simulator" },
    ],
  },
  {
    slug: "forecast",
    menu: "Forecast",
    title: "In-year forecast playbook",
    summary: "Re-run the same engine under changed assumptions. Forecast is not a separate model.",
    owner: "Group Tax / FP&A liaison",
    steps: [
      { n: "01", title: "Set the scenario", body: "BOI extension, Thai payroll, Ireland TP margin. These assumptions feed dashboard, map, top-up and GIR.", href: "/simulator", hrefLabel: "Simulator" },
      { n: "02", title: "Read YTD vs projected", body: "YTD is the live calculation. Projected FY uses the in-year pack.", href: "/forecast", hrefLabel: "Forecast" },
      { n: "03", title: "Push to exposure", body: "If scenario top-up moves, return to the dashboard and allocation before telling the business.", href: "/overview", hrefLabel: "Dashboard" },
    ],
  },
  {
    slug: "compliance",
    menu: "Compliance",
    title: "GIR & filing playbook",
    summary: "Calculation → GIR XML → validate → export → local matrix → notifications.",
    owner: "GIR preparer / filing coordinator",
    steps: [
      { n: "01", title: "Generate GIR", body: "XML carries the live group top-up. Validate schema, then export the pack.", href: "/gir", hrefLabel: "GIR" },
      { n: "02", title: "Complete the matrix", body: "Central filing relieves local GIR where conditions hold. Status follows GIR export and snapshot approval.", href: "/filings", hrefLabel: "Filing matrix" },
      { n: "03", title: "Notifications", body: "Generate local notifications and SbS / UTPR memos. Archive after file.", href: "/notifications", hrefLabel: "Notifications" },
    ],
  },
  {
    slug: "review",
    menu: "Review",
    title: "Review & lock playbook",
    summary: "Issues, second-level AI reviewer, evidence, then preparer / reviewer segregation.",
    owner: "Reviewer (Group Tax Director or engagement partner)",
    steps: [
      { n: "01", title: "Work the issue list", body: "Blocks must clear before lock. Send Gap Hunter requests; do not close on estimates.", href: "/issues", hrefLabel: "Issues" },
      { n: "02", title: "Trace every number", body: "Open the audit trail from any amount. Rule IDs go to the rulebook; source files go to Data Hub.", href: "/audit", hrefLabel: "Audit trail" },
      { n: "03", title: "Approve the snapshot", body: "Return or approve. Approval is remembered on the filing matrix.", href: "/approvals", hrefLabel: "Approvals" },
    ],
  },
  {
    slug: "intelligence",
    menu: "Intelligence",
    title: "Intelligence playbook",
    summary: "Ask GMT24 from the calculation. The rulebook and jurisdiction packs are the authority — not model memory.",
    owner: "Any user with workspace access",
    steps: [
      { n: "01", title: "Ask from the number", body: "Use the docked copilot. Answers cite calc + source + rule + version.", href: "/copilot", hrefLabel: "AI Copilot" },
      { n: "02", title: "Check the rule", body: "Effective-dated OECD and local packs. The DAG selects by jurisdiction, year and entity.", href: "/rulebook", hrefLabel: "OECD rulebook" },
      { n: "03", title: "Confirm the pack", body: "IIR / QDMTT / UTPR flags and qualified status before you tell a country they collect.", href: "/jurisdictions", hrefLabel: "Jurisdiction rules" },
    ],
  },
];

export function playbookBySlug(slug: string) {
  return PLAYBOOKS.find((p) => p.slug === slug) ?? null;
}
