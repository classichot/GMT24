import { PLAYBOOKS, playbookByNavGroup, playbookBySlug, type Playbook, type PlayStep } from "./playbooks";
import { SCREENS, screenFor } from "./ai/context";
import type { ScreenMeta } from "./ai/types";
import type { ProductMode } from "./model";

/**
 * One playbook per sidebar menu (not one per nav group). Authored books keep
 * their copy; every other menu gets a focused book from the screen catalog.
 */

export type SidebarMenu = {
  group: string;
  href: string;
  label: string;
  advisor?: boolean;
  inviteHide?: boolean;
};

/** Same order and flags as the AppShell NAV — the playbook grid follows this. */
export const SIDEBAR_MENUS: SidebarMenu[] = [
  { group: "Overview", href: "/overview", label: "Global dashboard" },
  { group: "Overview", href: "/etr-map", label: "ETR map" },
  { group: "Overview", href: "/exposure", label: "Top-up exposure" },
  { group: "Group", href: "/clients", label: "Clients", advisor: true },
  { group: "Group", href: "/group", label: "Group structure" },
  { group: "Group", href: "/entities", label: "Entities" },
  { group: "Group", href: "/graph", label: "Ownership graph" },
  { group: "Data", href: "/data", label: "Data Hub" },
  { group: "Data", href: "/mapping", label: "Account mapping" },
  { group: "Data", href: "/quality", label: "Data quality" },
  { group: "Data", href: "/requests", label: "Data requests" },
  { group: "Assurance", href: "/xray", label: "Pillar Two X-Ray" },
  { group: "Assurance", href: "/xray/confirm", label: "Confirmations" },
  { group: "Pillar Two", href: "/scope", label: "Scope" },
  { group: "Pillar Two", href: "/safe-harbours", label: "Safe harbours" },
  { group: "Pillar Two", href: "/globe-income", label: "GloBE income" },
  { group: "Pillar Two", href: "/fx", label: "FX / FANIL GAAP" },
  { group: "Pillar Two", href: "/covered-taxes", label: "Covered taxes" },
  { group: "Pillar Two", href: "/deferred-tax", label: "Deferred tax" },
  { group: "Pillar Two", href: "/etr", label: "ETR" },
  { group: "Pillar Two", href: "/sbie", label: "SBIE" },
  { group: "Pillar Two", href: "/top-up", label: "Top-up tax" },
  { group: "Pillar Two", href: "/allocation", label: "QDMTT / IIR / UTPR" },
  { group: "Elections & Optimizer", href: "/elections", label: "Election engine" },
  { group: "Elections & Optimizer", href: "/optimize", label: "Optimize GloBE" },
  { group: "Elections & Optimizer", href: "/years", label: "Year record" },
  { group: "Thailand", href: "/thailand", label: "Jurisdiction pack" },
  { group: "Thailand", href: "/thailand/liability", label: "Liability dashboard" },
  { group: "Thailand", href: "/thailand/filing", label: "Filing command" },
  { group: "Thailand", href: "/thailand/boi", label: "BOI Optimizer" },
  { group: "Thailand", href: "/thailand/gap", label: "OECD vs RD gap" },
  { group: "Thailand", href: "/thailand/audit", label: "Audit defence" },
  { group: "Incentives", href: "/incentives", label: "Tax incentives" },
  { group: "Incentives", href: "/thailand/boi", label: "BOI Optimizer" },
  { group: "Forecast", href: "/simulator", label: "Simulator" },
  { group: "Forecast", href: "/forecast", label: "Forecast" },
  { group: "Compliance", href: "/gir", label: "GIR" },
  { group: "Compliance", href: "/filings", label: "Filing matrix" },
  { group: "Compliance", href: "/notifications", label: "Notifications" },
  { group: "Compliance", href: "/archive", label: "Filing archive" },
  { group: "Review", href: "/review-guide", label: "Review guide" },
  { group: "Review", href: "/issues", label: "Issues" },
  { group: "Review", href: "/audit", label: "Audit trail" },
  { group: "Review", href: "/evidence", label: "Evidence" },
  { group: "Review", href: "/evidence-history", label: "Evidence history" },
  { group: "Review", href: "/approvals", label: "Approvals" },
  { group: "Review", href: "/host", label: "Host desk", inviteHide: true },
  { group: "AI Co-Pilot", href: "/copilot", label: "Co-Pilot hub" },
  { group: "AI Co-Pilot", href: "/quickscan", label: "Quick Scan" },
  { group: "AI Co-Pilot", href: "/trainer", label: "App Trainer" },
  { group: "AI Co-Pilot", href: "/reviewer", label: "Calculation Reviewer" },
  { group: "AI Co-Pilot", href: "/strategy", label: "Strategy Simulator" },
  { group: "AI Co-Pilot", href: "/rehearsal", label: "Audit Rehearsal" },
  { group: "AI Co-Pilot", href: "/regwatch", label: "Regulatory Watch" },
  { group: "AI Co-Pilot", href: "/briefing", label: "CFO Briefing" },
  { group: "AI Co-Pilot", href: "/tasks", label: "Tasks" },
  { group: "AI Co-Pilot", href: "/feedback", label: "Feedback" },
  { group: "Intelligence", href: "/rulebook", label: "OECD rulebook" },
  { group: "Intelligence", href: "/legal", label: "Legal corpus" },
  { group: "Intelligence", href: "/publications", label: "OECD publications" },
  { group: "Intelligence", href: "/updates", label: "Latest update" },
  { group: "Intelligence", href: "/jurisdictions", label: "Jurisdiction rules" },
  { group: "Intelligence", href: "/settings", label: "Settings" },
];

const PRIMARY_HREF: Record<string, string> = {
  overview: "/overview",
  group: "/group",
  data: "/data",
  "pillar-two": "/globe-income",
  incentives: "/incentives",
  forecast: "/forecast",
  compliance: "/gir",
  review: "/issues",
  "app-review": "/review-guide",
  intelligence: "/rulebook",
  thailand: "/thailand",
  "oecd-rd-gap": "/thailand/gap",
  "boi-optimizer": "/thailand/boi",
  elections: "/elections",
  assurance: "/xray",
  copilot: "/copilot",
};

const COPY: Record<string, { law: string; aiSuggests: string; youDecide: string }> = {
  overview: {
    law: "Art. 5.2 posts jurisdictional top-up. This menu exists to read the group number before anyone opens a return.",
    aiSuggests: "Where the engine shows exposure, open the ETR map and the collector trail.",
    youDecide: "Which jurisdictions you brief first. The headline is already posted.",
  },
  group: {
    law: "Art. 1.1 — lock the MNE Group and the UPE before any blend is calculated.",
    aiSuggests: "Run the €750m test and the entity tests (MOCE / POPE / excluded).",
    youDecide: "Who is in the perimeter. A model guess does not add a CE.",
  },
  data: {
    law: "Nothing posts to GloBE Income until a person approves the mapping. The LLM never posts a number.",
    aiSuggests: "Open the dataset guideline, drop the missing required sources, hold anything under 80% confidence, and send Gap Hunter requests for incomplete files.",
    youDecide: "Approve, hold or send back. Approval writes the Art. 3.2 / 3.5 delta.",
  },
  "pillar-two": {
    law: "FANIL → GloBE income → covered taxes → ETR → SBIE → top-up → QDMTT / IIR / UTPR. Engine only.",
    aiSuggests: "Confirm harbours and elections before you compute a full file.",
    youDecide: "Which elections and harbours are on the GIR. The arithmetic is already posted.",
  },
  incentives: {
    law: "Pillar Two does not cancel a holiday. It claws back part of the advertised CIT. Report net retained value.",
    aiSuggests: "Inventory certificates, then rank keep / 10% / QRTC pending / 20% on 10-year NPV.",
    youDecide: "Do not book Thai QRTC. Do not tell the board the certificate is 0% CIT.",
  },
  forecast: {
    law: "Forecast is the same engine under changed assumptions — not a second model.",
    aiSuggests: "Set the scenario, then read YTD versus projected FY.",
    youDecide: "Whether a scenario is briefed. Adopt writes through the gateway.",
  },
  compliance: {
    law: "GIR XML is not the Thai return. Central filing relieves a local GIR only where the conditions hold.",
    aiSuggests: "Validate population and reconciliation, then export. Notifications share the same snapshot.",
    youDecide: "When to file and which portal. GMT24 does not submit to any authority.",
  },
  review: {
    law: "A snapshot cannot lock while a material X-Ray item or a blocking issue is open.",
    aiSuggests: "Work the issue list, then the audit trail, then evidence history, then approvals.",
    youDecide: "Approve or return. Reviewer must be a different person from the preparer.",
  },
  "app-review": {
    law: "An external reviewer must be able to replay ingest → mapping → calculation against the OECD engine.",
    aiSuggests: "Load the close pack, approve the held FX mapping, then verify the posted anchors.",
    youDecide: "Whether the demo file is ready to show. Do not invent a number to close a gap.",
  },
  intelligence: {
    law: "The rulebook and jurisdiction packs are the authority — not model memory.",
    aiSuggests: "Ask from a posted amount. Click a rule id to land on the pack version that posted it.",
    youDecide: "Which pack amendment is accepted. Administrator review is required for the change record.",
  },
  thailand: {
    law: "The GloBE Core is not the Thai RD return. TH-PACK-2567 overlays situs, SBIE No. 4, BOT FX and ss 54–58 clocks.",
    aiSuggests: "Run the OECD vs RD gap review before anyone copies a GloBE figure onto a Thai form.",
    youDecide: "How to order Thai liability and what stays a documented exception.",
  },
  "oecd-rd-gap": {
    law: "Pure OECD rules and the GloBE Core calculation are not the Thai RD return.",
    aiSuggests: "Score aligned / overlay / diverge / pending. Lock BOT rates and PE category first.",
    youDecide: "Which diverge items close this year. Do not tell the RD that the GIR XML is the Thai return.",
  },
  "boi-optimizer": {
    law: "Pillar Two claws back part of the advertised BOI holiday. Rank bookable scenarios on 10-year NPV.",
    aiSuggests: "Keep 0%, convert to 10% (Announcement 1/2566), QRTC pending, or 20% baseline.",
    youDecide: "Do not book Thai QRTC. Report net retained incentive, not the 0% on the certificate.",
  },
  elections: {
    law: "A JURISDICTION election binds every CE in that country. Five-year locks are statutory, not optional.",
    aiSuggests: "Only legally available elections are offered. Rank FY tax, lock-in, burden and audit risk.",
    youDecide: "Which package is filed in GIR section D. Reset returns to Core.",
  },
  assurance: {
    law: "Facts a trial balance cannot prove must be confirmed, evidenced and dual-signed before the snapshot can be approved.",
    aiSuggests: "Work Material findings by top-up at risk. Significant and Observation never unlock the year.",
    youDecide: "The answer the evidence supports. The Co-Pilot cannot sign.",
  },
  copilot: {
    law: "Ask → investigate → explain → propose → review → execute → record. No LLM posts a number or a legal position.",
    aiSuggests: "Start on the hub, or ask from the number you are looking at. The router picks the feature.",
    youDecide: "Every action is proposed before it runs. Gateway permissions follow the signed-in role.",
  },
};

const DEFAULT_AI = "The Trainer names the next gate from the catalog. Copilot cites calc + rule + source.";
const DEFAULT_YOU = "Approve, hold, attach evidence or file. The language model does not post a GloBE number.";

function groupBook(module: string): Playbook | null {
  return (
    playbookByNavGroup(module) ??
    playbookByNavGroup(module === "Elections" ? "Elections & Optimizer" : module) ??
    playbookByNavGroup(module === "Workspace" ? "Intelligence" : module) ??
    null
  );
}

function authoredForHref(href: string): Playbook | null {
  return PLAYBOOKS.find((p) => PRIMARY_HREF[p.slug] === href) ?? null;
}

export function enrichPlaybook(book: Playbook, href = PRIMARY_HREF[book.slug] ?? book.href): Playbook {
  const copy = COPY[book.slug];
  return {
    ...book,
    href: href ?? book.steps[0]?.href,
    law: book.law ?? copy?.law ?? book.summary,
    aiSuggests: book.aiSuggests ?? copy?.aiSuggests ?? DEFAULT_AI,
    youDecide: book.youDecide ?? copy?.youDecide ?? DEFAULT_YOU,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function stepsForScreen(screen: ScreenMeta, group: Playbook | null): PlayStep[] {
  const own = (group?.steps ?? []).filter((s) => s.href === screen.href);
  const steps: PlayStep[] = [
    { n: "01", title: `Open ${screen.title}`, body: screen.purpose, href: screen.href, hrefLabel: "Go" },
  ];
  for (const s of own) {
    if (steps.some((x) => x.title === s.title)) continue;
    steps.push({ ...s, n: pad(steps.length + 1), hrefLabel: "Go" });
  }
  for (const action of screen.actions.slice(0, 2)) {
    if (steps.some((x) => x.title === action)) continue;
    steps.push({ n: pad(steps.length + 1), title: action, body: "A catalog action on this menu. Open the screen and run it from there.", href: screen.href, hrefLabel: "Go" });
  }
  if (group && !own.length) {
    const next = group.steps.find((s) => s.href !== screen.href);
    if (next) steps.push({ ...next, n: pad(steps.length + 1), hrefLabel: "Go" });
  }
  return steps.slice(0, 4);
}

export function playbookFromScreen(screen: ScreenMeta): Playbook {
  const authored = authoredForHref(screen.href);
  if (authored) return enrichPlaybook(authored, screen.href);
  const group = groupBook(screen.module);
  return {
    slug: screen.key,
    menu: screen.title,
    navGroup: screen.module,
    href: screen.href,
    title: `${screen.title} playbook`,
    summary: screen.purpose,
    owner: group?.owner ?? "Workspace user",
    law: screen.purpose,
    aiSuggests: screen.actions[0] ? `Next catalog action: ${screen.actions[0]}.` : (group ? enrichPlaybook(group).aiSuggests : DEFAULT_AI),
    youDecide: group ? enrichPlaybook(group).youDecide : DEFAULT_YOU,
    steps: stepsForScreen(screen, group),
  };
}

export function bookForMenu(href: string): Playbook | null {
  const clean = href.split("?")[0].replace(/\/$/, "") || "/";
  const authored = authoredForHref(clean);
  if (authored && PRIMARY_HREF[authored.slug] === clean) return enrichPlaybook(authored, clean);
  const screen = screenFor(clean);
  if (screen && !clean.startsWith("/playbook/")) return playbookFromScreen(screen);
  if (authored) return enrichPlaybook(authored, clean);
  return null;
}

export function bookBySlug(slug: string): Playbook | null {
  const authored = playbookBySlug(slug);
  if (authored) return enrichPlaybook(authored);
  const screen = SCREENS.find((s) => s.key === slug);
  return screen ? playbookFromScreen(screen) : null;
}

export function visibleSidebarMenus(mode: ProductMode, invite: boolean): SidebarMenu[] {
  const seen = new Set<string>();
  return SIDEBAR_MENUS.filter((m) => {
    if (m.advisor && mode !== "advisor") return false;
    if (m.inviteHide && invite) return false;
    if (seen.has(m.href)) return false;
    seen.add(m.href);
    return true;
  });
}

export type NumberedMenuBook = { n: string; menu: SidebarMenu; book: Playbook };

export function numberedMenuBooks(mode: ProductMode, invite: boolean): NumberedMenuBook[] {
  return visibleSidebarMenus(mode, invite).map((menu, i) => {
    const book = bookForMenu(menu.href) ?? playbookFromScreen({
      key: menu.href.replace(/^\//, "").replace(/\//g, "-"),
      module: menu.group,
      title: menu.label,
      purpose: `${menu.label} in ${menu.group}.`,
      fields: [],
      actions: [],
      href: menu.href,
    });
    return { n: pad(i + 1), menu, book };
  });
}

export function playbookCode(slug: string, mode: ProductMode, invite: boolean): string | null {
  return numberedMenuBooks(mode, invite).find((x) => x.book.slug === slug)?.n ?? null;
}
