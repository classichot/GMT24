import { PLAYBOOKS, playbookByNavGroup, type Playbook } from "../playbooks";
import { SCREENS, screenFor } from "./context";
import { tokens } from "./knowledge";
import type { ScreenMeta } from "./types";

/**
 * Product catalog for Ask GMT24. Indexes every menu (screen registry) and every
 * playbook so the Trainer can answer “what is this menu for?” and “show the
 * playbook” from the same source the sidebar uses — not from model memory.
 */

const EXTRA_ALIASES: Record<string, string[]> = {
  overview: ["dashboard", "global dashboard", "home", "แดชบอร์ด"],
  "etr-map": ["etr map", "world map", "แผนที่ etr"],
  exposure: ["top-up exposure", "who pays", "exposure"],
  clients: ["client portfolio", "engagements"],
  group: ["group structure", "upe", "โครงสร้างกลุ่ม"],
  entities: ["constituent entities", "ce list"],
  graph: ["ownership graph", "tax graph"],
  data: ["data hub", "ingest", "upload", "close pack"],
  mapping: ["account mapping", "smart mapping", "จับคู่บัญชี"],
  quality: ["data quality", "readiness"],
  requests: ["data requests", "gap hunter"],
  xray: ["x-ray", "xray", "pillar two x-ray", "hard stop"],
  "xray-confirm": ["confirmations", "x-ray confirmation"],
  copilot: ["co-pilot", "copilot", "ask gmt24", "ai hub"],
  trainer: ["app trainer", "onboarding"],
  reviewer: ["calculation reviewer", "second-level"],
  strategy: ["strategy simulator", "what-if"],
  rehearsal: ["audit rehearsal", "ซ้อมตรวจ"],
  regwatch: ["regulatory watch", "reg watch", "impact watch"],
  briefing: ["cfo briefing", "board briefing"],
  tasks: ["task list"],
  feedback: ["feedback collector", "ticket"],
  quickscan: ["quick scan", "scan", "สแกน"],
  host: ["host desk", "demo link", "review link"],
  "review-guide": ["review guide", "app reviewer"],
  "evidence-history": ["evidence history", "chronicle"],
  audit: ["audit trail", "one-click audit"],
  gir: ["gir", "globe information return"],
  rulebook: ["oecd rulebook", "rulebook"],
  jurisdictions: ["jurisdiction packs", "central record"],
  "thailand-gap": ["oecd vs rd", "gap review"],
  "thailand-boi": ["boi optimizer"],
};

export type CatalogHit =
  | { kind: "screen"; screen: ScreenMeta; book: Playbook | null; score: number; matched: string }
  | { kind: "playbook"; book: Playbook; score: number; matched: string };

function aliasesFor(s: ScreenMeta): string[] {
  return [s.title, s.key, s.module, s.href.replace(/^\//, "").replace(/\//g, " "), ...(EXTRA_ALIASES[s.key] ?? [])];
}

function bookAliases(b: Playbook): string[] {
  return [b.title, b.menu, b.slug, b.navGroup ?? "", `${b.menu} playbook`, `${b.slug} playbook`, `คู่มือ ${b.menu}`];
}

function scoreHay(q: string, labels: string[], hay: string): { score: number; matched: string } {
  const l = q.toLowerCase();
  let score = 0;
  let matched = "";
  for (const a of labels) {
    const n = a.toLowerCase().trim();
    if (!n || n.length < 2) continue;
    if (l.includes(n) && n.length >= matched.length) {
      score = Math.max(score, 8 + Math.min(n.length, 12));
      matched = a;
    }
  }
  if (!matched) {
    const qt = new Set(tokens(q));
    const ht = tokens(hay);
    let hit = 0;
    for (const t of ht) if (qt.has(t)) hit += 1;
    if (qt.size && hit / qt.size >= 0.5 && hit >= 2) {
      score = hit;
      matched = "topic";
    }
  }
  return { score, matched };
}

/** Best screen and/or playbook named in the question. Title/alias hits beat topic overlap. */
export function locateCatalog(q: string): CatalogHit | null {
  const wantBook = /playbook|walkthrough|คู่มือ|ขั้นตอนของเมนู|how (do|does|to) (we |i )?(use|work|run) /i.test(q);
  let best: CatalogHit | null = null;

  for (const s of SCREENS) {
    const { score, matched } = scoreHay(q, aliasesFor(s), `${s.title} ${s.purpose} ${s.module}`);
    if (score < 8) continue;
    const book = playbookByNavGroup(s.module) ?? PLAYBOOKS.find((p) => p.steps.some((st) => st.href === s.href)) ?? null;
    const hit: CatalogHit = { kind: "screen", screen: s, book, score, matched };
    if (!best || hit.score > best.score) best = hit;
  }
  for (const b of PLAYBOOKS) {
    const { score, matched } = scoreHay(q, bookAliases(b), `${b.title} ${b.summary} ${b.menu}`);
    if (score < 8) continue;
    const hit: CatalogHit = { kind: "playbook", book: b, score: score + (wantBook ? 4 : 0), matched };
    if (!best || hit.score > best.score) best = hit;
  }
  if (wantBook && best?.kind === "screen" && best.book) {
    return { kind: "playbook", book: best.book, score: best.score + 2, matched: best.matched };
  }
  return best;
}

/** True when the question is about a GMT24 menu, screen or playbook — not a number or a statute. */
export function isCatalogQuestion(q: string): boolean {
  if (/art\.?\s*\d|article\s+\d|oecd model|what is the (capital|corporate)/i.test(q)) return false;
  if (/\b(top-?up|etr|sbie|covered tax|globe income)\b/i.test(q) && /\b(vietnam|thailand|ireland|เวียดนาม|ไทย|ไอร์แลนด์|why is|how much)\b/i.test(q)) return false;
  if (/playbook|คู่มือ|เมนู|this (screen|page|menu|module)|หน้านี้|เมนูนี้/i.test(q)) return true;
  if (/what (is|does)|what'?s|explain|how (do|does|can) i|สำหรับอะไร|คืออะไร|ทำอะไร|built for|used for/i.test(q) && locateCatalog(q)) return true;
  return false;
}

export function catalogForPath(path: string): { screen: ScreenMeta | null; book: Playbook | null } {
  const screen = screenFor(path);
  const book = screen ? playbookByNavGroup(screen.module) ?? PLAYBOOKS.find((p) => p.steps.some((st) => st.href === screen.href)) ?? null : null;
  return { screen, book };
}
