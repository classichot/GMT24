import type { JurCalc } from "../engine";
import { eur } from "../format";
import type { PackAmendment } from "../packAmendments";
import { propose } from "./actions";
import { AUTHORITY_LABEL, KNOWLEDGE } from "./knowledge";
import { DEFAULT_WATCHED_SOURCES, type RegChange, type RegSourceState } from "./regwatchSources";
import type { KbEntry, RegReviewStatus, Reply, Section, WorkContext } from "./types";

/**
 * AI Regulatory Impact Watch. Three monitored streams: changes detected by the
 * server monitor on configured official sources (new documents, amended pages —
 * see lib/server/regwatch.ts), knowledge-base entries in pending-review status,
 * and OECD Central Record pack amendments. Each item carries an impact analysis
 * against the group's live figures. Nothing reaches production rules or the
 * knowledge base without an expert decision, which is recorded.
 */
export const WATCHED_SOURCES = DEFAULT_WATCHED_SOURCES;

export type WatchItem = {
  id: string;
  kind: "kb" | "pack" | "source";
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  affected: { iso: string; name: string; topUp: number; why: string }[];
  quantified: string | null;
  status: RegReviewStatus | "pack";
  entry?: KbEntry;
  pack?: PackAmendment;
  change?: RegChange;
  url?: string;
};

export function watchItems(calcs: JurCalc[], packAmendments: PackAmendment[], regReview: Record<string, { status: RegReviewStatus }>, changes: RegChange[] = []): WatchItem[] {
  const out: WatchItem[] = [];
  const mains = calcs.filter((c) => c.blendKind === "main");
  for (const ch of changes) {
    const s = ch.summary;
    const isos = s?.jurisdictions ?? [];
    const global = isos.length === 0;
    const affected = global
      ? (s && s.confidence === "low" ? [] : mains.filter((c) => c.jurisdictionalTopUp > 0 || c.iso === "TH"))
      : mains.filter((c) => isos.includes(c.iso));
    const statusLabel = s ? `${s.publicationStatus}${s.applicableFrom ? ` · applies from ${s.applicableFrom}` : ""}` : "unreviewed";
    out.push({
      id: ch.id, kind: "source",
      title: s?.title ?? ch.title,
      source: `${ch.sourceLabel} · ${ch.signal === "new-doc" ? "new document" : "amended page"} · ${statusLabel}`,
      publishedAt: ch.detectedAt.slice(0, 10),
      summary: s ? `${s.summary}${s.potentialImpacts.length ? `\n\nPotential impacts (model-proposed, for expert review):\n${s.potentialImpacts.map((p) => `• ${p}`).join("\n")}` : ""}` : `${ch.summaryError ?? "No model summary."}\n\n${ch.excerpt.slice(0, 1200)}`,
      affected: affected.map((c) => ({ iso: c.iso, name: c.name, topUp: c.jurisdictionalTopUp, why: global ? "Global guidance — every in-scope jurisdiction is potentially affected" : `Named jurisdiction in the ${ch.signal === "new-doc" ? "document" : "change"}` })),
      quantified: affected.length ? `${eur(affected.reduce((a, c) => a + c.jurisdictionalTopUp, 0))} of current top-up sits in the jurisdictions this item names. Amount effect not computed — production rules change only through a rule-pack release after review.` : null,
      status: regReview[ch.id]?.status ?? "pending",
      change: ch,
      url: ch.url,
    });
  }
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

export function sourceLine(s: RegSourceState): string {
  const when = s.lastChecked ? `last checked ${s.lastChecked.slice(0, 16).replace("T", " ")}` : "not yet checked";
  const st = s.lastStatus === "error" ? ` — unreachable: ${s.lastError}` : s.lastChangedAt ? ` — last change ${s.lastChangedAt.slice(0, 10)}` : s.lastStatus === "ok" ? " — unchanged since baseline" : "";
  return `${s.label} — ${s.cadence}, ${when}${st}`;
}

export function regwatchReply(items: WatchItem[], ctx: WorkContext, focus?: string, sources: RegSourceState[] = []): Reply {
  const sections: Section[] = [];
  const actions = [];
  const pending = items.filter((i) => i.status === "pending" || i.status === "pack");
  const target = focus ? items.find((i) => i.id === focus || i.title.toLowerCase().includes(focus.toLowerCase())) : undefined;
  if (target) {
    sections.push({ kind: "conclusion", text: `${target.title} — ${target.source}, ${target.publishedAt || "undated"}. Status: ${target.status}.` });
    sections.push({ kind: "text", title: target.kind === "source" ? "Change summary (model-proposed, awaiting expert review)" : "Change summary", text: target.summary });
    if (target.change?.summary?.topics.length) sections.push({ kind: "facts", items: [`Topics: ${target.change.summary.topics.join(", ")}`, `Publication status: ${target.change.summary.publicationStatus}${target.change.summary.applicableFrom ? ` · applies from ${target.change.summary.applicableFrom}` : ""}`, `Detected ${target.change.detectedAt.slice(0, 16).replace("T", " ")} · summary confidence ${target.change.summary.confidence}`] });
    if (target.affected.length) sections.push({ kind: "table", title: "Affected calculations", head: ["Jurisdiction", "Current top-up", "Why affected"], rows: target.affected.map((a) => [a.name, eur(a.topUp), a.why]) });
    else sections.push({ kind: "facts", items: ["No current jurisdiction in this group is affected."] });
    if (target.quantified) sections.push({ kind: "impact", items: [target.quantified] });
    sections.push({ kind: "next", items: target.kind === "kb" ? ["Approve into the knowledge base — reassessment tasks open for each affected jurisdiction.", "Or reject as not applicable, with a note kept on the record.", "Production rule parameters change only through a rule-pack release."] : ["Decide the pack amendment on Jurisdiction packs (accept/reject); an administrator then closes the change record."] });
    if ((target.kind === "kb" || target.kind === "source") && target.status === "pending") {
      actions.push(propose("approve-reg", { id: target.id, note: "" }, ctx));
      actions.push(propose("reject-reg", { id: target.id, note: "" }, ctx));
    }
    if (target.kind === "pack" && target.pack) {
      actions.push(propose("decide-pack", { id: target.pack.id, status: "accepted" }, ctx));
      actions.push(propose("decide-pack", { id: target.pack.id, status: "rejected" }, ctx));
    }
  } else {
    const checked = sources.filter((s) => s.lastChecked);
    const unreachable = sources.filter((s) => s.lastStatus === "error");
    const monitorLine = !sources.length || !checked.length ? "The source monitor has not run yet — use “Check sources now” on Regulatory Impact Watch." : `${checked.length} of ${sources.length} sources checked${unreachable.length ? `; ${unreachable.length} unreachable from this network` : ""}.`;
    sections.push({ kind: "conclusion", text: pending.length ? `${pending.length} regulatory item${pending.length === 1 ? "" : "s"} await expert review (${pending.filter((i) => i.kind === "source").length} detected on official sources). ${items.filter((i) => i.affected.length).length} touch this group's jurisdictions. ${monitorLine}` : `No pending regulatory items. ${monitorLine}` });
    sections.push({ kind: "table", title: "Review queue", head: ["Item", "Source", "Published", "Affected", "Status"], rows: items.slice(0, 8).map((i) => [i.title, i.source, i.publishedAt || "—", i.affected.map((a) => a.iso).join(", ") || "none", i.status]) });
    sections.push({ kind: "list", title: "Monitored sources", items: (sources.length ? sources.map(sourceLine) : WATCHED_SOURCES.map((s) => `${s.label} — ${s.cadence}, not yet checked`)) });
    sections.push({ kind: "next", items: ["Open an item for the impact analysis and the approve/reject decision.", "Approved items enter the knowledge base and open reassessment tasks; rejected items stay on the record."] });
    actions.push(propose("navigate", { href: "/regwatch", label: "Open Regulatory Impact Watch" }, ctx));
    if (pending[0]?.kind === "kb" || pending[0]?.kind === "source") actions.push(propose("approve-reg", { id: pending[0].id, note: "" }, ctx));
  }
  return {
    id: `r-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    feature: "regwatch",
    title: target ? `Regulatory Impact Watch · ${target.title}` : "Regulatory Impact Watch",
    sections,
    cites: target?.url ? [{ label: target.change?.sourceLabel ?? target.source, href: target.url }] : (sources.length ? sources : WATCHED_SOURCES).slice(0, 4).map((s) => ({ label: s.label, href: s.url })),
    actions,
    grounded: true,
    unsupported: [],
    version: ctx.calcVersion,
    lang: ctx.lang,
    chips: pending.slice(0, 3).map((i) => `Impact of: ${i.title.slice(0, 45)}`),
  };
}
