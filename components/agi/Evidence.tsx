"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { EVIDENCE_KIND_LABEL, evidenceFor, evidenceKindTag, verifyEvidence } from "@/lib/agi/evidence";
import { shortHash } from "@/lib/agi/case";
import type { EvidenceItem, MissionRecord } from "@/lib/agi/types";

function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function EvidenceRow({ e }: { e: EvidenceItem }) {
  return (
    <li>
      <span className="seq">#{e.seq}</span>
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`tag ${evidenceKindTag(e.kind)}`} style={{ fontSize: 10 }}>{EVIDENCE_KIND_LABEL[e.kind]}</span>
          <strong>{e.title}</strong>
          <span style={{ color: "var(--color-neutral-600)" }}>{when(e.at)} · {String(e.by)} · case {shortHash(e.caseHash)}</span>
          {e.href && <Link href={e.href} style={{ fontSize: 11 }}>open</Link>}
        </div>
        <div style={{ marginTop: 3, lineHeight: 1.5 }}>{e.detail}</div>
        {(e.refs.length > 0 || (e.ruleVersions?.length ?? 0) > 0) && (
          <div style={{ marginTop: 3, color: "var(--color-neutral-600)" }}>
            {e.refs.length > 0 && <span>Refs: {e.refs.slice(0, 6).join(", ")}{e.refs.length > 6 ? ` +${e.refs.length - 6}` : ""}</span>}
            {(e.ruleVersions?.length ?? 0) > 0 && <span> · Rules: {e.ruleVersions!.slice(0, 4).map((r) => `${r.id} ${r.version}`).join(", ")}{e.ruleVersions!.length > 4 ? ` +${e.ruleVersions!.length - 4}` : ""}</span>}
          </div>
        )}
        <div className="hash">{e.prevHash.slice(0, 12)} → {e.hash}</div>
      </div>
    </li>
  );
}

/** "Show the evidence behind this conclusion": filtered by what the evidence supports. */
export function EvidencePanel({ m, supports, title = "Evidence", compact = false }: { m: MissionRecord; supports?: string; title?: string; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [kind, setKind] = useState<string>("all");
  const items = useMemo(() => {
    const base = supports ? evidenceFor(m, supports) : m.evidence;
    return (kind === "all" ? base : base.filter((e) => e.kind === kind)).slice().reverse();
  }, [m, supports, kind]);
  const chain = verifyEvidence(m.evidence);
  const kinds = [...new Set(m.evidence.map((e) => e.kind))];
  return (
    <section className="panel">
      <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h4 style={{ flex: 1 }}>{title} <span style={{ color: "var(--color-neutral-600)", fontWeight: 400, fontSize: 12 }}>· {items.length} of {m.evidence.length} records</span></h4>
        <span className={`tag ${chain.ok ? "tag-ok" : "tag-hot"}`} title="Every record is hash-chained to the previous one">
          {chain.ok ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}<span style={{ marginLeft: 4 }}>{chain.ok ? "Chain intact" : `Chain broken at #${chain.brokenAt}`}</span>
        </span>
        {open && (
          <select className="input" style={{ maxWidth: 200, minHeight: 30, padding: "2px 8px", fontSize: 12 }} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All kinds</option>
            {kinds.map((k) => <option key={k} value={k}>{EVIDENCE_KIND_LABEL[k]}</option>)}
          </select>
        )}
        <button className="btn btn-ghost" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <div className="panel-body">
          {items.length === 0 ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>No evidence yet for this filter.</div> : <ul className="agi-evidence">{items.map((e) => <EvidenceRow key={e.id} e={e} />)}</ul>}
        </div>
      )}
    </section>
  );
}
