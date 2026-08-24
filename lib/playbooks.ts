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
      { n: "03", title: "Walk entities into ETR", body: "Run the entity test (MOCE ≤ 30% UPE ownership; POPE if outsiders hold > 20% of a non-UPE Parent). Open an entity row to land on that blend’s ETR — not a mixed country rate.", href: "/entities", hrefLabel: "Entities" },
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
      { n: "01", title: "Confirm scope, harbours and elections", body: "Do not compute a full GloBE file if a transitional harbour already takes the jurisdiction out. Then run the Election Engine — stock compensation, realisation, SBIE max/partial/none and Simplified ETR inner options can change the answer before anyone files GIR section D.", href: "/elections", hrefLabel: "Elections" },
      { n: "02", title: "Build the ETR", body: "GloBE income (FANIL engine) then covered taxes, including the Deferred Tax Intelligence Engine (recast, Art. 4.4.5 exceptions, five-year recapture). Then jurisdictional ETR.", href: "/deferred-tax", hrefLabel: "Deferred tax" },
      { n: "03", title: "Top-up and collection", body: "SBIE, excess, top-up tax, then who pays — QDMTT first, residual IIR, then UTPR. For Thailand open the Thai Liability Dashboard; do not stop at the global allocation screen.", href: "/thailand/liability", hrefLabel: "Thai liability" },
    ],
  },
  {
    slug: "incentives",
    menu: "Incentives",
    title: "Tax incentive playbook",
    summary: "Extract the certificate, decide SBTISH, then run the BOI–Pillar Two Optimizer — not a copilot guess at 0% CIT.",
    owner: "Local tax + Group Tax",
    steps: [
      { n: "01", title: "Inventory incentives", body: "BOI, DEI, KDB, development allowances. Record rate, dates, remaining cap and source PDF. Thai BOI needs a project ledger and a jurisdictional GloBE ledger.", href: "/incentives", hrefLabel: "Tax incentives" },
      { n: "02", title: "SBTISH screen", body: "IP boxes (e.g. Irish KDB) are not substance-based. Only substance-conditioned holidays go to SBTISH review. Thai QRTC is not enacted — do not book it.", href: "/safe-harbours", hrefLabel: "Safe harbours" },
      { n: "03", title: "Optimise net BOI value", body: "Four scenarios: keep 0%, convert to 10% (Announcement 1/2566), future QRTC/SBTISH, 20% baseline. Rank on 10-year NPV. Report net retained, not the face of the certificate.", href: "/thailand/boi", hrefLabel: "BOI Optimizer" },
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
      { n: "04", title: "Mint a host desk link", body: "7L only. Generate a signed demo URL with 1–14 day life. Recipients open /review/{token} on another device until expiry. Do not put the host key on public login.", href: "/host", hrefLabel: "Host desk" },
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
      { n: "03", title: "Confirm the pack", body: "IIR / QDMTT / UTPR flags and qualified status before you tell a country they collect. Thailand has its own pack — do not stop at the OECD Central Record row.", href: "/thailand", hrefLabel: "Thailand pack" },
    ],
  },
  {
    slug: "thailand",
    menu: "Thailand",
    title: "Thailand Jurisdiction Pack playbook",
    summary: "GloBE Core first, then the Thai pack: situs, SBIE, BOT FX, liability ordering, BOI optimizer, filing clocks, defence book. Calculation rules available; filing schema pending.",
    owner: "Thai tax lead / Group Tax",
    steps: [
      { n: "01", title: "Run the OECD vs RD gap review", body: "Do not treat the GloBE Core as the Thai return. Score aligned / overlay / diverge / pending / Core data gap. Lock BOT rates and PE category first.", href: "/thailand/gap", hrefLabel: "OECD vs RD" },
      { n: "02", title: "Order Thai liability", body: "Waterfall: jurisdictional top-up − foreign QDMTT − IIR already imposed = residual UTPR → designated taxpayer. Then scope memo, situs and Thai SBIE.", href: "/thailand/liability", hrefLabel: "Liability dashboard" },
      { n: "03", title: "File, optimise BOI, defend", body: "ss 54–58 clocks, then the BOI Optimizer (keep vs 10% vs QRTC pending vs 20%). Assemble the Audit Defence Book. Do not tell the board the holiday is 0% CIT.", href: "/thailand/boi", hrefLabel: "BOI Optimizer" },
    ],
  },
  {
    slug: "oecd-rd-gap",
    menu: "OECD vs RD",
    title: "OECD vs Thai RD gap playbook",
    summary: "Pure OECD rules and the GloBE Core calculation are not the Thai RD return. Close diverge items, overlay Thai procedure, and hold pending instruments as documented exceptions.",
    owner: "Thai tax lead / reviewer",
    steps: [
      { n: "01", title: "Separate the tests", body: "Run the gap review. Open the source pin on each topic (OECD article, RD instrument, GMT24 rule) before anyone copies a GloBE number onto a Thai form. Lock BOT rates and PE category first.", href: "/thailand/gap", hrefLabel: "Gap review" },
      { n: "02", title: "Reconcile numbers that diverge", body: "Thai SBIE Notification No. 4 versus OECD SBIE. Covered-tax questionnaire versus Art. 4. FANIL stays on OECD 3.2 until Section 31 exists — the LLM does not fill that gap.", href: "/thailand/sbie", hrefLabel: "Thai SBIE" },
      { n: "03", title: "Order liability and hold pending items", body: "QDMTT / IIR / UTPR waterfall and designated taxpayer. Document ss 31, 33 and 53–57 as coverage exceptions. Do not tell the RD that the GIR XML is the Thai return.", href: "/thailand/liability", hrefLabel: "Liability" },
    ],
  },
  {
    slug: "boi-optimizer",
    menu: "BOI Optimizer",
    title: "BOI–Pillar Two Incentive Optimizer playbook",
    summary: "Pillar Two does not cancel BOI. It claws back part of the advertised CIT holiday. Rank keep / 10% conversion / QRTC pending / 20% baseline on 10-year NPV. Do not book Thai QRTC.",
    owner: "Thai tax lead / Group Tax / CFO briefing",
    steps: [
      { n: "01", title: "Inventory every certificate", body: "Remaining exemption years, reduced-rate years, unused cap, promoted vs non-promoted accounts. Project BOI accounting is not the Thai GloBE jurisdiction.", href: "/incentives", hrefLabel: "Certificates" },
      { n: "02", title: "Run the four scenarios", body: "Keep 0%. Convert under Announcement 1/2566 (10% for twice remaining full years, cap 10). Future QRTC/SBTISH — do not book. 20% CIT plus non-tax privileges.", href: "/thailand/boi", hrefLabel: "Optimizer" },
      { n: "03", title: "Stress blending, SBIE and harbours", body: "A high-tax Thai CE can shelter a BOI entity. Asset-light projects keep less SBIE. Fail transitional harbours before you assert a clawback.", href: "/safe-harbours", hrefLabel: "Harbours" },
      { n: "04", title: "Brief the board on net value", body: "Rank only bookable scenarios. 10% is not automatically cheaper. Report net retained incentive, not the 0% printed on the certificate.", href: "/thailand/boi", hrefLabel: "NPV" },
    ],
  },
  {
    slug: "elections",
    menu: "Elections",
    title: "Election & Scenario Optimizer playbook",
    summary: "Pillar Two is not one calculation. Detect every legally available election and harbour at the correct OECD scope, generate bookable combinations, then rank lowest FY tax, 5-year lock-in, compliance burden and audit risk.",
    owner: "Group Tax / preparer / reviewer",
    steps: [
      { n: "01", title: "Read the baseline", body: "Default GloBE is Core with no elective overlays. Do not start from a copilot guess.", href: "/etr", hrefLabel: "ETR" },
      { n: "02", title: "Run the eligibility engine", body: "Only legally available elections are offered. A JURISDICTION election binds every CE in that country. QDMTT / SbS status comes from the OECD Central Record.", href: "/elections", hrefLabel: "Election engine" },
      { n: "03", title: "Generate scenarios, then optimise", body: "GMT24 models eligible combinations — not 2^40 switches. Rank lowest FY tax, 5-year lock-in, compliance burden and audit risk. Then file the GIR election fields.", href: "/optimize", hrefLabel: "Optimize GloBE" },
      { n: "04", title: "Lock the year, then open the next", body: "In-house and Advisor use the same year ledger. Advisor keeps one ledger per client. Lock the final calc and elections, then open the next year: five-year locks carry, Art. 4.5 cannot be re-elected after revocation, and GMT24 compares both elections and amounts.", href: "/years", hrefLabel: "Year record" },
    ],
  },
];

export function playbookBySlug(slug: string) {
  return PLAYBOOKS.find((p) => p.slug === slug) ?? null;
}
