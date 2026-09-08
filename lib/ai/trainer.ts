import { ACCOUNTS } from "../model";
import { propose } from "./actions";
import { catalogForPath, locateCatalog } from "./catalog";
import { SCREENS, screenFor } from "./context";
import type { Playbook } from "../playbooks";
import type { InteractionMode, Reply, ScreenMeta, Section, UserRole, WorkContext } from "./types";
import { ROLE_LABEL } from "./types";

/**
 * AI App Trainer. Reads the screen registry, the workflow state and the
 * outstanding work in the context, and answers in one of three modes: explain
 * the screen, show the path, or help finish the step with a previewed action.
 */
export type WalkStep = { href: string; target: string; text: string };

export const ONBOARDING: Record<UserRole, { title: string; steps: WalkStep[] }> = {
  preparer: {
    title: "Preparer — ingest, map, confirm, hand over",
    steps: [
      { href: "/data", target: "load-pack", text: "Load the close pack. Classification runs first; nothing calculates until maps are approved." },
      { href: "/mapping", target: "map-table", text: "Approve every mapping at or above 80% confidence. Hold the rest for the reviewer with a note." },
      { href: "/xray/confirm", target: "xray-list", text: "Answer the routed confirmations for your department and attach the required evidence. Sign as preparer." },
      { href: "/globe-income", target: "adjustments", text: "Check each Art. 3.2 adjustment has a source document and a reviewer." },
      { href: "/approvals", target: "gates", text: "Read the review gates. Anything open is yours to close before hand-over." },
    ],
  },
  reviewer: {
    title: "Reviewer — challenge, sign, lock",
    steps: [
      { href: "/reviewer", target: "findings", text: "Run the Calculation Reviewer. Validation failures are red; suspected issues are labelled separately." },
      { href: "/xray", target: "hardstop", text: "Check the hard-stop list. Material items must be confirmed, supported and reviewer-signed." },
      { href: "/audit", target: "trail", text: "Click any amount and read the trail: rule → entity → account → source. Use Explain this number for the note." },
      { href: "/gir", target: "preflight", text: "Run the GIR XML preflight." },
      { href: "/approvals", target: "approve", text: "Approve the snapshot. The button is disabled while X-Ray blocks." },
    ],
  },
  "tax-manager": {
    title: "Tax manager — decide, optimise, brief",
    steps: [
      { href: "/overview", target: "headline", text: "Start from the headline top-up. Click it — the trail is the answer to 'where does this come from'." },
      { href: "/elections", target: "register", text: "Review available elections. Five-year locks are marked; the engine refuses early revocation." },
      { href: "/strategy", target: "ask", text: "Ask the Strategy Simulator a what-if in plain language. Adoption always goes through review." },
      { href: "/regwatch", target: "queue", text: "Clear the expert review queue. Nothing reaches production rules without you." },
      { href: "/briefing", target: "audience", text: "Generate the CFO briefing and check every figure against the version stamp." },
    ],
  },
  admin: {
    title: "Administrator — packs, access, records",
    steps: [
      { href: "/jurisdictions", target: "scan", text: "Scan the OECD Central Record. Differences become proposals; reviewers decide; you close the change record." },
      { href: "/settings", target: "settings", text: "Operating mode, theme, evidence-history immutability." },
      { href: "/evidence-history", target: "chain", text: "Verify the hash chain. Turning immutability off is itself logged." },
      { href: "/host", target: "desk", text: "Host desk mints 1–30 day review links. The host key never appears on the public login page." },
      { href: "/copilot", target: "quality", text: "Watch Co-Pilot quality: grounded answers, unsupported statements, failed actions." },
    ],
  },
};

/** Validation and workflow messages the product can emit, with corrective steps. */
export const ERRORS: { match: RegExp; title: string; cause: string; fix: string[]; href: string; action?: { id: "approve-map" | "navigate"; params: Record<string, string> } }[] = [
  { match: /upload|drop|file (failed|rejected)|classif/i, title: "Upload not posted", cause: "A dropped file is classified and queued, but the demo classifier only posts the full close pack. Single drops stay queued until the pack is loaded.", fix: ["Open Data Hub", "Load the Aetherion FY2026 demo pack (or the sample CSVs)", "Check Evidence history for the 'File received' row"], href: "/data" },
  { match: /mapping|62%|confidence|830010|held/i, title: "Mapping held below 80% confidence", cause: "Account 830010 FX Gain classified at 62%. The engine posts the account at its default category until a human approves.", fix: ["Open Account mapping", "Read the proposed GloBE category and adjustment", "Approve, or hold with a note for the reviewer"], href: "/mapping", action: { id: "approve-map", params: { account: "830010" } } },
  { match: /gir|xml|schema|preflight|validation error/i, title: "GIR preflight not run", cause: "Sections C and D report missing fields until the preflight reconciles population and collection.", fix: ["Open GIR", "Run Validate XML", "Fix any population mismatch listed, then export"], href: "/gir" },
  { match: /approv(al|e) (is )?blocked|cannot approve|hard.?stop|blocked/i, title: "Approval blocked by X-Ray", cause: "One or more material findings are unconfirmed, unsupported, inconsistently classified or missing reviewer approval.", fix: ["Open Pillar Two X-Ray", "Work the hard-stop list top-down by top-up at risk", "Answer → attach evidence → preparer sign → reviewer sign"], href: "/xray" },
  { match: /five.?year|early revocation|re-?elect|revoked/i, title: "Election refused by the consistency engine", cause: "Dropping a five-year lock before it expires, or re-electing Art. 4.5 after revocation, is a GIR consistency breach.", fix: ["Open Election engine", "Read the lock start year on the track", "Wait for expiry or open the next year"], href: "/elections" },
  { match: /403|central record|oecd (page|scan) (blocked|failed)/i, title: "OECD page blocked automated access", cause: "The Central Record HTML returned 403. GMT24 falls back to the published PDF and parses it column-aware.", fix: ["Open Jurisdiction packs", "Re-run Scan OECD Record — the PDF path is automatic", "If the PDF also fails, review manually against the linked source"], href: "/jurisdictions" },
  { match: /sign|preparer|reviewer (must|cannot)|same person/i, title: "Signing gate", cause: "Preparer must sign first; reviewer must be a different person; all active questions and evidence must be complete.", fix: ["Answer every active question", "Attach each required evidence kind", "Switch operating mode to sign as the other role"], href: "/xray/confirm" },
];

export function nextStep(ctx: WorkContext): { title: string; why: string; href: string; action?: ReturnType<typeof propose> }[] {
  const o = ctx.outstanding;
  const out: { title: string; why: string; href: string; action?: ReturnType<typeof propose> }[] = [];
  if (!o.ingestReady) out.push({ title: "Load the close pack", why: "No source data is posted; the engine is idle.", href: "/data" });
  if (o.mapsPending.length) out.push({ title: `Approve ${o.mapsPending.length} held mapping${o.mapsPending.length === 1 ? "" : "s"}`, why: `Account ${o.mapsPending.join(", ")} below 80% confidence.`, href: "/mapping", action: propose("approve-map", { account: o.mapsPending[0] }, ctx) });
  if (o.xrayMaterial) out.push({ title: `Clear ${o.xrayMaterial} material X-Ray item${o.xrayMaterial === 1 ? "" : "s"}`, why: "Final approval is hard-stopped until these are confirmed, supported and reviewed.", href: "/xray" });
  if (o.adjUnsigned.length) out.push({ title: `Sign ${o.adjUnsigned.length} GloBE adjustment${o.adjUnsigned.length === 1 ? "" : "s"}`, why: `${o.adjUnsigned.join(", ")} have no reviewer.`, href: "/globe-income" });
  if (o.packPending) out.push({ title: `Decide ${o.packPending} pack amendment${o.packPending === 1 ? "" : "s"}`, why: "AI proposals from the OECD Central Record await a reviewer.", href: "/jurisdictions" });
  if (o.packUnreviewed && ctx.role === "admin") out.push({ title: "Close the pack change record", why: "Administrator review is outstanding.", href: "/jurisdictions" });
  if (!o.reviewerRan) out.push({ title: "Run the Calculation Reviewer", why: "Second-level review has not run on this snapshot.", href: "/reviewer", action: propose("run-reviewer", {}, ctx) });
  if (!o.girValidated) out.push({ title: "Run GIR preflight", why: "Sections C–D still report missing fields.", href: "/gir", action: propose("validate-gir", {}, ctx) });
  if (!o.snapshotApproved && !o.xrayMaterial && o.reviewerRan && o.girValidated) out.push({ title: "Approve the snapshot", why: "All gates clear.", href: "/approvals", action: propose("approve-snapshot", {}, ctx) });
  if (!out.length) out.push({ title: "Nothing outstanding", why: `${ctx.fy} snapshot approved. Lock the year on Year record when filings are ready.`, href: "/years" });
  return out;
}

function playbookSections(book: Playbook): Section[] {
  return [
    { kind: "conclusion", text: `${book.title}. ${book.summary}` },
    { kind: "facts", items: [`Owner: ${book.owner}`] },
    { kind: "steps", title: "Playbook", items: book.steps.map((s) => `${s.n}. ${s.title} — ${s.body}`) },
  ];
}

function screenSections(screen: ScreenMeta): Section[] {
  const sections: Section[] = [{ kind: "conclusion", text: `${screen.title} is built to: ${screen.purpose}` }];
  if (screen.fields.length) sections.push({ kind: "table", title: "Fields and terms", head: ["Term", "Meaning"], rows: screen.fields.map((f) => [f.term, f.meaning]) });
  if (screen.actions.length) sections.push({ kind: "list", title: "What you can do here", items: screen.actions });
  return sections;
}

/** Reply that explains a named menu or its playbook. Used by Ask GMT24 and the sidebar Explain control. */
export function explainCatalog(q: string, ctx: WorkContext, forcedHref?: string): Reply | null {
  const hit = forcedHref
    ? (() => {
        const { screen, book } = catalogForPath(forcedHref);
        if (screen) return { kind: "screen" as const, screen, book, score: 99, matched: screen.title };
        if (book) return { kind: "playbook" as const, book, score: 99, matched: book.title };
        return null;
      })()
    : locateCatalog(q);
  if (!hit) return null;
  const wantBook = /playbook|walkthrough|คู่มือ|ขั้นตอน/i.test(q);
  const sections: Section[] = [];
  const actions: ReturnType<typeof propose>[] = [];
  const cites: { label: string; href: string }[] = [{ label: `${ctx.appVersion} · product catalog`, href: "/trainer" }];
  let title = "App Trainer";

  if (hit.kind === "playbook" || (wantBook && hit.kind === "screen" && hit.book)) {
    const book = hit.kind === "playbook" ? hit.book : hit.book!;
    title = `Playbook · ${book.menu}`;
    sections.push(...playbookSections(book));
    cites.push({ label: book.title, href: `/playbook/${book.slug}` });
    actions.push(propose("navigate", { href: `/playbook/${book.slug}`, label: `Open ${book.menu} playbook` }, ctx));
    actions.push(propose("navigate", { href: book.steps[0].href, label: book.steps[0].hrefLabel }, ctx));
  } else if (hit.kind === "screen") {
    title = `This menu · ${hit.screen.title}`;
    sections.push(...screenSections(hit.screen));
    cites.push({ label: hit.screen.title, href: hit.screen.href });
    if (hit.book) {
      sections.push({ kind: "next", title: `${hit.book.menu} playbook`, items: hit.book.steps.map((s) => `${s.n}. ${s.title}`) });
      cites.push({ label: hit.book.title, href: `/playbook/${hit.book.slug}` });
      actions.push(propose("navigate", { href: hit.screen.href, label: `Open ${hit.screen.title}` }, ctx));
      actions.push(propose("navigate", { href: `/playbook/${hit.book.slug}`, label: "Open the playbook" }, ctx));
    } else {
      actions.push(propose("navigate", { href: hit.screen.href, label: `Open ${hit.screen.title}` }, ctx));
    }
  }
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "trainer",
    title,
    sections,
    cites,
    actions,
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: ["What is this menu for?", "Show the playbook", "What should I do next?"],
  };
}

export function trainerReply(q: string, ctx: WorkContext, mode: InteractionMode | null): Reply {
  const l = q.toLowerCase();
  const sections: Section[] = [];
  const actions: ReturnType<typeof propose>[] = [];
  const cites = [{ label: `${ctx.appVersion}`, href: "/trainer" }];
  let title = "App Trainer";
  const screen = ctx.screen ?? screenFor("/overview")!;

  const named = explainCatalog(q, ctx);
  if (named && (locateCatalog(q) || /this (screen|page|menu)|หน้านี้|เมนูนี้|playbook|คู่มือ/i.test(q))) {
    return named;
  }

  const err = ERRORS.find((e) => e.match.test(l));
  const onboardRole = (Object.keys(ROLE_LABEL) as UserRole[]).find((r) => l.includes(r.replace("-", " ")) || l.includes(r));

  if (mode === "show" || /show me|walk ?through|guide me|แสดง/.test(l)) {
    const role = onboardRole ?? ctx.role;
    const ob = ONBOARDING[role];
    title = `Show me · ${ob.title}`;
    sections.push({ kind: "text", text: `Interactive walkthrough for a ${ROLE_LABEL[role].toLowerCase()}. Each step opens the screen and highlights the control.` });
    sections.push({ kind: "steps", items: ob.steps.map((s, i) => `${i + 1}. ${s.text} (${s.href})`) });
    actions.push(propose("navigate", { href: `/trainer?role=${role}&start=1`, label: "Start guided walkthrough" }, ctx));
  } else if (err && (mode === "complete" || /error|fail|why|cannot|can't|blocked|refused|ผิดพลาด|ไม่ได้/.test(l))) {
    title = `Error diagnosis · ${err.title}`;
    sections.push({ kind: "conclusion", text: err.cause });
    sections.push({ kind: "steps", title: "Corrective steps", items: err.fix });
    if (err.title.includes("Mapping")) {
      const row = ACCOUNTS.find((a) => a.account === "830010");
      if (row) sections.push({ kind: "facts", items: [`Actual validation state: ${row.account} ${row.name} · ${row.confidence}% · ${row.globe} → ${row.adjustment}`] });
    }
    if (err.title.includes("X-Ray")) sections.push({ kind: "facts", items: [`Actual state: ${ctx.outstanding.xrayMaterial} material unresolved · $${ctx.outstanding.xrayExposure.toLocaleString()} top-up at risk.`] });
    actions.push(propose("navigate", { href: err.href, label: "Open correction workflow" }, ctx));
    if (err.action?.id === "approve-map" && ctx.outstanding.mapsPending.includes(err.action.params.account)) actions.push(propose("approve-map", { account: err.action.params.account }, ctx));
  } else if (mode === "complete" || /next step|what should i do|what.?s (left|outstanding|next)|help me (complete|finish)|ขั้นตอนถัดไป|ทำอะไรต่อ/.test(l)) {
    const steps = nextStep(ctx);
    title = "Help me complete it";
    sections.push({ kind: "conclusion", text: `${steps.length === 1 && steps[0].title === "Nothing outstanding" ? steps[0].why : `${steps.length} thing${steps.length === 1 ? "" : "s"} stand between this snapshot and approval.`}` });
    sections.push({ kind: "steps", items: steps.map((s, i) => `${i + 1}. ${s.title} — ${s.why}`) });
    for (const s of steps.slice(0, 3)) {
      if (s.action) actions.push(s.action);
      else actions.push(propose("navigate", { href: s.href, label: s.title }, ctx));
    }
    if (ctx.outstanding.mapsPending.length && !actions.some((a) => a.actionId === "approve-map")) {
      const row = ACCOUNTS.find((a) => a.account === ctx.outstanding.mapsPending[0]);
      if (row) sections.push({ kind: "text", title: "Assisted completion", text: `Proposed value for ${row.account} ${row.name}: ${row.globe}${row.adjustment ? ` → ${row.adjustment}` : ""}. Preview before saving is on the action below.` });
    }
  } else if (onboardRole || /onboard|getting started|new here|first time|เริ่มต้น/.test(l)) {
    const role = onboardRole ?? ctx.role;
    const ob = ONBOARDING[role];
    title = `Onboarding · ${ROLE_LABEL[role]}`;
    sections.push({ kind: "text", text: ob.title });
    sections.push({ kind: "steps", items: ob.steps.map((s, i) => `${i + 1}. ${s.text}`) });
    actions.push(propose("navigate", { href: `/trainer?role=${role}`, label: "Open onboarding track" }, ctx));
  } else {
    const here = catalogForPath(ctx.path);
    title = `This menu · ${here.screen?.title ?? screen.title}`;
    sections.push(...screenSections(here.screen ?? screen));
    if (here.book) {
      sections.push({ kind: "next", title: `${here.book.menu} playbook`, items: here.book.steps.map((s) => `${s.n}. ${s.title}`) });
      cites.push({ label: here.book.title, href: `/playbook/${here.book.slug}` });
      actions.push(propose("navigate", { href: `/playbook/${here.book.slug}`, label: "Open the playbook" }, ctx));
    }
    const glossary = SCREENS.flatMap((s) => s.fields).find((f) => l.includes(f.term.toLowerCase().split(" ")[0]) && f.term.length > 3 && l.includes(f.term.toLowerCase()));
    if (glossary) sections.push({ kind: "text", title: glossary.term, text: glossary.meaning });
    const steps = nextStep(ctx).slice(0, 2);
    sections.push({ kind: "next", items: steps.map((s) => `${s.title} — ${s.why}`) });
    actions.push(propose("navigate", { href: screen.href === ctx.path ? "/trainer" : screen.href, label: screen.href === ctx.path ? "Open App Trainer" : screen.title }, ctx));
  }

  sections.push({ kind: "text", text: `Instructions match ${ctx.appVersion}. Screen id: ${screen.key}.` });
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "trainer",
    title,
    sections,
    cites,
    actions,
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: ["Explain this screen", "Show me the reviewer path", "What should I do next?", "Why did my upload fail?"],
  };
}
