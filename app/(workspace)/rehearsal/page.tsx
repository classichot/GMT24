"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { readiness } from "@/lib/ai/rehearsal";

export default function RehearsalPage() {
  const ai = useAi();
  const qs = ai.rehearsal;
  const areas = readiness(qs);
  const [area, setArea] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(qs[0]?.id ?? null);
  const rows = qs.filter((q) => area === "all" || q.area === area);
  const overall = areas.length ? Math.round(areas.reduce((s, a) => s + a.score, 0) / areas.length) : 0;
  const pkg = () => {
    const md = [`# Audit rehearsal — ${ai.ctx.groupName} · ${ai.ctx.fy}`, `${ai.ctx.calcVersion} · prepared ${new Date().toISOString().slice(0, 10)} · internal readiness assessment, not a prediction of RD acceptance`, ""];
    for (const q of qs) { md.push(`## ${q.area}${q.iso ? ` · ${q.iso}` : ""} — ${q.strength}`, `**Q.** ${q.question}`, "", `**Model answer.** ${q.answer}`, "", `Evidence: ${q.evidence.join("; ") || "none on file"}`, q.gaps.length ? `Gaps: ${q.gaps.join("; ")}` : "No gaps identified.", ""); }
    ai.run(propose("download", { name: `GMT24-audit-rehearsal-${ai.ctx.fy}.md`, body: md.join("\n") }, ai.ctx));
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="callout" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <strong>Internal readiness assessment — not a prediction of what the Revenue Department will accept.</strong>
          <div className="text-muted" style={{ marginTop: 4 }}>Questions an auditor would ask about this group&apos;s figures, the answer the trace and evidence register support today, the evidence on file, and the gaps. Every gap can become a remediation task.</div>
        </div>
        <button className="btn btn-secondary" onClick={pkg}><Download size={14} />Rehearsal package</button>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: `repeat(${Math.min(6, areas.length + 1)}, 1fr)` }}>
        <div className="kpi"><div className="kpi-label">Overall</div><div className="kpi-val">{overall}%</div><div className="kpi-sub">{qs.length} questions</div></div>
        {areas.slice(0, 5).map((a) => <div key={a.area} className="kpi"><div className="kpi-label">{a.area}</div><div className="kpi-val" style={{ fontSize: 26 }}>{a.score}%</div><div className={`kpi-sub${a.gaps ? " hot" : ""}`}>{a.n} q · {a.gaps} gaps</div></div>)}
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <h5>Question bank</h5>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["all", ...areas.map((a) => a.area)].map((a) => <button key={a} className={`chip${area === a ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setArea(a)}>{a}</button>)}</div>
        </div>
        <div>
          {rows.map((q) => (
            <div key={q.id} style={{ borderBottom: "1px solid var(--color-divider)" }}>
              <button className="nav-btn" style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12 }} onClick={() => setOpen(open === q.id ? null : q.id)}>
                <span className={`tag ${q.strength === "strong" ? "tag-ok" : q.strength === "partial" ? "tag-warn" : "tag-hot"}`} style={{ fontSize: 10 }}>{q.strength}</span>
                <span style={{ fontWeight: 700 }}>{q.question}</span>
                <span className="text-muted" style={{ fontSize: 11 }}>{q.area}{q.iso ? ` · ${q.iso}` : ""}</span>
              </button>
              {open === q.id && (
                <div style={{ padding: "0 16px 14px 16px", fontSize: 13, display: "grid", gap: 8, background: "var(--color-surface)" }}>
                  <div><div className="reply-label">Model answer from the trace</div>{q.answer}</div>
                  <div className="grid-split" style={{ gap: 16 }}>
                    <div><div className="reply-label">Evidence on file</div>{q.evidence.length ? <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{q.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul> : <span className="text-muted">None — this answer is unsupported.</span>}</div>
                    <div><div className="reply-label">Gaps and contradictions</div>{q.gaps.length ? <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{q.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul> : <span className="text-muted">None identified.</span>}
                      {q.gaps.length > 0 && <button className="btn btn-secondary" style={{ fontSize: 11, marginTop: 6 }} onClick={() => ai.run(propose("create-task", { title: `Rehearsal gap · ${q.question.slice(0, 60)}`, detail: q.gaps.join("; "), owner: "Preparer", severity: q.strength === "weak" ? "block" : "warn", href: "/rehearsal", source: "rehearsal" }, ai.ctx))}>Create remediation task</button>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
