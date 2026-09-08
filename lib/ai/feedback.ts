import { propose } from "./actions";
import { tokens } from "./knowledge";
import type { Reply, Ticket, TicketCategory, WorkContext } from "./types";

/**
 * AI Feedback Collector. Turns a comment into a reproducible ticket: category,
 * severity, steps, expected vs actual, and only the context the user allows.
 * Duplicate detection runs against existing tickets before submission.
 */
export function categorise(text: string): { category: TicketCategory; severity: Ticket["severity"] } {
  const l = text.toLowerCase();
  let category: TicketCategory = "usability";
  if (/wrong|incorrect|error|crash|fail|broken|bug|doesn.?t (work|save)|ผิด|พัง|ไม่ทำงาน/.test(l)) category = "bug";
  else if (/should (have|be able)|add|could you|would be (nice|good)|feature|request|อยาก|เพิ่ม/.test(l)) category = "feature";
  else if (/data|figure|amount|number|balance|ตัวเลข|ข้อมูล/.test(l) && /wrong|off|mismatch|differ|ไม่ตรง/.test(l)) category = "data";
  else if (/\?|how do|what is|why does|ทำไม|อย่างไร/.test(l) && !/slow|confus/.test(l)) category = "question";
  let severity: Ticket["severity"] = "medium";
  if (/cannot|can't|blocked|crash|lost|wrong (top-?up|amount)|filing/.test(l)) severity = "high";
  if (/all users|production|every|data loss|filed/.test(l)) severity = "critical";
  if (/minor|typo|cosmetic|small|nit/.test(l)) severity = "low";
  if (category === "question") severity = "low";
  return { category, severity };
}

export function similarity(a: string, b: string) {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  ta.forEach((t) => { if (tb.has(t)) n += 1; });
  return n / Math.max(ta.size, tb.size);
}

export function findDuplicate(text: string, tickets: Ticket[]): Ticket | null {
  let best: { t: Ticket; s: number } | null = null;
  for (const t of tickets) {
    const s = Math.max(similarity(text, `${t.title} ${t.description}`), similarity(text, t.title));
    if (s >= 0.45 && (!best || s > best.s)) best = { t, s };
  }
  return best?.t ?? null;
}

export function draftTicket(text: string, ctx: WorkContext, tickets: Ticket[], includeContext: { screen: boolean; versions: boolean; steps: boolean }, reporter: string): Ticket {
  const { category, severity } = categorise(text);
  const dup = findDuplicate(text, tickets);
  const firstLine = text.split(/[.!?\n]/)[0].trim();
  const title = firstLine.length > 8 ? firstLine.slice(0, 90) : text.slice(0, 90);
  const steps = includeContext.steps
    ? [`Open ${ctx.screen?.title ?? ctx.path} (${ctx.path})`, ctx.iso ? `Jurisdiction context: ${ctx.jurisdiction} (${ctx.iso})` : `Group: ${ctx.groupName} · ${ctx.fy}`, `Observed: ${text.trim()}`]
    : [`Observed: ${text.trim()}`];
  const included: string[] = [];
  const excluded: string[] = [];
  (includeContext.screen ? included : excluded).push(`screen ${ctx.path}`);
  (includeContext.versions ? included : excluded).push(`app ${ctx.appVersion}`, `calc ${ctx.calcVersion}`);
  excluded.push("tax figures", "entity data", "attachments");
  const n = tickets.length + 1;
  return {
    id: `tk-${Date.now().toString(36)}`,
    ref: `FB-${String(n).padStart(4, "0")}`,
    title,
    description: text.trim(),
    steps,
    category,
    severity,
    status: "new",
    screen: includeContext.screen ? ctx.path : "(withheld)",
    appVersion: includeContext.versions ? ctx.appVersion : "(withheld)",
    calcVersion: includeContext.versions ? ctx.calcVersion : "(withheld)",
    lang: ctx.lang,
    reporter,
    createdAt: new Date().toISOString(),
    contextIncluded: included,
    contextExcluded: excluded,
    duplicateOf: dup?.ref ?? null,
    updates: [{ at: new Date().toISOString(), note: "Created from Co-Pilot feedback." }],
  };
}

export function feedbackReply(ticket: Ticket, ctx: WorkContext, dup: Ticket | null): Reply {
  const sections: Reply["sections"] = [
    { kind: "conclusion", text: `Ticket ${ticket.ref} drafted — ${ticket.category}, ${ticket.severity}. Review the preview; nothing is submitted until you confirm.` },
    { kind: "table", title: "Ticket preview", head: ["Field", "Value"], rows: [
      ["Title", ticket.title],
      ["Category", ticket.category],
      ["Severity", ticket.severity],
      ["Screen", ticket.screen],
      ["App version", ticket.appVersion],
      ["Calculation version", ticket.calcVersion],
      ["Language", ticket.lang.toUpperCase()],
    ] },
    { kind: "steps", title: "Reproduction steps", items: ticket.steps },
    { kind: "facts", title: "Context included", items: ticket.contextIncluded },
    { kind: "list", title: "Context excluded", items: ticket.contextExcluded },
  ];
  if (dup) sections.splice(1, 0, { kind: "warning", text: `Possible duplicate of ${dup.ref} "${dup.title}" (${dup.status}). Submitting links the new report to it.` });
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "feedback",
    title: `Feedback · ${ticket.ref}`,
    sections,
    cites: [{ label: "Feedback tracker", href: "/feedback" }],
    actions: [
      propose("create-ticket", { id: ticket.id }, ctx),
      propose("navigate", { href: "/feedback", label: "Open feedback tracker" }, ctx),
    ],
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
  };
}
