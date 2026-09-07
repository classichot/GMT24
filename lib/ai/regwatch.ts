import type { JurCalc } from "../engine";
import { eur } from "../format";
import type { PackAmendment } from "../packAmendments";
import { propose } from "./actions";
import { AUTHORITY_LABEL, KNOWLEDGE } from "./knowledge";
import type { KbEntry, RegReviewStatus, Reply, Section, WorkContext } from "./types";

/**
 * AI Regulatory Impact Watch. Two monitored streams: knowledge-base entries in
 * pending-review status (OECD administrative guidance, Thai Revenue Department
 * notifications) and OECD Central Record pack amendments. Each item carries an
 * impact analysis against the group's live figures. Nothing reaches production
 * rules or the knowledge base without an expert decision, which is recorded.
 */
export const WATCHED_SOURCES = [
  { id: "oecd-ag", label: "OECD Administrative Guidance (Inclusive Framework)", url: "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax.html", cadence: "Weekly", lastChecked: "2026-09-01" },
  { id: "oecd-cr", label: "OECD Central Record — transitional qualified status", url: "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/central-record-of-legislation-with-transitional-qualified-status.html", cadence: "Weekly", lastChecked: "2026-09-01" },
  { id: "th-rd", label: "Thai Revenue Department — Top-up Tax Act notifications", url: "https://www.rd.go.th", cadence: "Weekly", lastChecked: "2026-09-01" },
  { id: "th-boi", label: "Thailand Board of Investment — announcements", url: "https://www.boi.go.th", cadence: "Monthly", lastChecked: "2026-08-15" },
];

export type WatchItem = {
  id: string;
  kind: "kb" | "pack";
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  affected: { iso: string; name: string; topUp: number; why: string }[];
  quantified: string | null;
  status: RegReviewStatus | "pack";
  entry?: KbEntry;
  pack?: PackAmendment;
};

export function watchItems(calcs: JurCalc[], packAmendments: PackAmendment[], regReview: Record<string, { status: RegReviewStatus }>): WatchItem[] {
  const out: WatchItem[] = [];
  for (const e of KNOWLEDGE.filter((k) => k.status === "pending-review" || k.status === "draft")) {
    const affected = calcs.filter((c) => c.blendKind === "main" && (e.jurisdictions.includes("*") || e.jurisdictions.includes(c.iso)) && (e.ruleIds.length === 0 || e.ruleIds.some((r) => hasRule(c, r))));
    out.push({
      id: e.id, kind: "kb", title: e.title, source: `${AUTHORITY_LABEL[e.authority]} · ${e.provision}`, publishedAt: e.publishedAt, summary: e.passage,
      affected: affected.map((c) => ({ iso: c.iso, name: c.name, topUp: c.jurisdictionalTopUp, why: e.ruleIds.length ? `Applies rule ${e.ruleIds.filter((r) => hasRule(c, r)).join(", ")}` : `In scope for ${c.name}` })),
      quantified: affected.length ? `${eur(affected.reduce((s, c) => s + c.jurisdictionalTopUp, 0))} of current top-up sits in affected jurisdictions. Amount effect not computed — the rule pack parameter is not changed by this item until approved and implemented.` : null,
      status: regReview[e.id]?.status ?? "pending",
      entry: e,
    });
  }
  for (const p of packAmendments.filter((x) => x.status === "proposed")) {
    const c = calcs.find((x) => x.iso === p.iso && x.blendKind === "main");
    out.push({
      id: p.id, kind: "pack", title: `${p.name} pack: ${p.field} ${String(p.current)} → ${String(p.proposed)}`, source: `OECD Central Record · ${p.asOf ?? "undated"}`, publishedAt: p.asOf ?? "", summary: p.rationale || "Difference between the signed pack and the Central Record.",
      affected: c ? [{ iso: c.iso, name: c.name, topUp: c.jurisdictionalTopUp, why: `Collection mechanism ${p.field} changes the payer path` }] : [],
      quantified: c ? `${eur(c.jurisdictionalTopUp)} ${c.name} top-up re-routes if accepted; the reviewer decision on Jurisdiction packs applies it to the overlay.` : null,
      status: "pack",
      pack: p,
    });
  }
  return out.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}

function hasRule(c: JurCalc, ruleId: string) {
  let hit = false;
  const visit = (n: JurCalc["audit"]) => { if (n.ruleId === ruleId) hit = true; n.children?.forEach(visit); };
  visit(c.audit);
  return hit;
}

export function regwatchReply(items: WatchItem[], ctx: WorkContext, focus?: string): Reply {
  const sections: Section[] = [];
  const actions = [];
  const pending = items.filter((i) => i.status === "pending" || i.status === "pack");
  const target = focus ? items.find((i) => i.id === focus || i.title.toLowerCase().includes(focus.toLowerCase())) : undefined;
  if (target) {
    sections.push({ kind: "conclusion", text: `${target.title} — ${target.source}, ${target.publishedAt || "undated"}. Status: ${target.status}.` });
    sections.push({ kind: "text", title: "Change summary", text: target.summary });
    if (target.affected.length) sections.push({ kind: "table", title: "Affected calculations", head: ["Jurisdiction", "Current top-up", "Why affected"], rows: target.affected.map((a) => [a.name, eur(a.topUp), a.why]) });
    else sections.push({ kind: "facts", items: ["No current jurisdiction in this group is affected."] });
    if (target.quantified) sections.push({ kind: "impact", items: [target.quantified] });
    sections.push({ kind: "next", items: target.kind === "kb" ? ["Approve into the knowledge base — reassessment tasks open for each affected jurisdiction.", "Or reject as not applicable, with a note kept on the record.", "Production rule parameters change only through a rule-pack release."] : ["Decide the pack amendment on Jurisdiction packs (accept/reject); an administrator then closes the change record."] });
    if (target.kind === "kb" && target.status === "pending") {
      actions.push(propose("approve-reg", { id: target.id, note: "" }, ctx));
      actions.push(propose("reject-reg", { id: target.id, note: "" }, ctx));
    }
    if (target.kind === "pack" && target.pack) {
      actions.push(propose("decide-pack", { id: target.pack.id, status: "accepted" }, ctx));
      actions.push(propose("decide-pack", { id: target.pack.id, status: "rejected" }, ctx));
    }
  } else {
    sections.push({ kind: "conclusion", text: pending.length ? `${pending.length} regulatory item${pending.length === 1 ? "" : "s"} await expert review. ${items.filter((i) => i.affected.length).length} touch this group's jurisdictions.` : "No pending regulatory items. All monitored sources checked; nothing new since the last review." });
    sections.push({ kind: "table", title: "Review queue", head: ["Item", "Source", "Published", "Affected", "Status"], rows: items.slice(0, 8).map((i) => [i.title, i.source, i.publishedAt || "—", i.affected.map((a) => a.iso).join(", ") || "none", i.status]) });
    sections.push({ kind: "list", title: "Monitored sources", items: WATCHED_SOURCES.map((s) => `${s.label} — ${s.cadence}, last checked ${s.lastChecked}`) });
    sections.push({ kind: "next", items: ["Open an item for the impact analysis and the approve/reject decision.", "Approved items enter the knowledge base and open reassessment tasks; rejected items stay on the record."] });
    actions.push(propose("navigate", { href: "/regwatch", label: "Open Regulatory Impact Watch" }, ctx));
    if (pending[0]?.kind === "kb") actions.push(propose("approve-reg", { id: pending[0].id, note: "" }, ctx));
  }
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "regwatch",
    title: target ? `Regulatory Impact Watch · ${target.title}` : "Regulatory Impact Watch",
    sections,
    cites: WATCHED_SOURCES.slice(0, 3).map((s) => ({ label: s.label, href: s.url })),
    actions,
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: pending.slice(0, 3).map((i) => `Impact of: ${i.title.slice(0, 45)}`),
  };
}
