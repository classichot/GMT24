"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { FEATURE_META, ROLE_LABEL, type FeatureId } from "@/lib/ai/types";
import { suggestionsFor } from "@/lib/ai/router";

const ORDER: FeatureId[] = ["quickscan", "trainer", "specialist", "explain", "feedback", "interviewer", "reviewer", "strategy", "rehearsal", "regwatch", "briefing"];

export default function CopilotHub() {
  const { setCopilotOpen } = useStore();
  const ai = useAi();
  const q = ai.state.quality;
  const grounded = q.length ? Math.round((q.filter((r) => r.grounded).length / q.length) * 100) : null;
  const avgLatency = q.length ? Math.round(q.reduce((s, r) => s + r.latencyMs, 0) / q.length) : null;
  const byFeature = ORDER.map((f) => ({ f, n: q.filter((r) => r.feature === f).length }));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="callout" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <strong>One Co-Pilot, eleven connected features.</strong>
          <div className="text-muted" style={{ marginTop: 4 }}>Ask → investigate → explain → propose action → review → execute → record. Every feature reads the same context ({ai.ctx.groupName} · {ai.ctx.fy} · {ai.ctx.screen?.title ?? "General"}), the same fact registry and the same calculation trace; every action goes through the gateway as <strong>{ROLE_LABEL[ai.ctx.role]}</strong>.</div>
        </div>
        <div className="stack-actions">
          <Link href="/playbook/copilot" className="btn btn-secondary">Playbook</Link>
          <button className="btn btn-primary" onClick={() => setCopilotOpen(true)}><MessageSquare size={14} />Open the panel</button>
        </div>
      </div>

      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Replies</div><div className="kpi-val">{q.length}</div><div className="kpi-sub">{ai.state.threads.length} thread{ai.state.threads.length === 1 ? "" : "s"}</div></div>
        <div className="kpi"><div className="kpi-label">Grounded</div><div className="kpi-val">{grounded == null ? "—" : `${grounded}%`}</div><div className="kpi-sub">{q.reduce((s, r) => s + r.unsupported, 0)} unsupported statements shown</div></div>
        <div className="kpi"><div className="kpi-label">Median latency</div><div className="kpi-val">{avgLatency == null ? "—" : `${avgLatency} ms`}</div><div className="kpi-sub">deterministic — no model call</div></div>
        <div className="kpi"><div className="kpi-label">Gateway</div><div className="kpi-val">{ai.state.audit.filter((a) => a.kind === "action" || a.kind === "draft").length}</div><div className="kpi-sub">{ai.state.audit.filter((a) => a.kind === "refused").length} refused</div></div>
      </div>

      <div className="grid-3">
        {ORDER.map((f) => {
          const m = FEATURE_META[f];
          return (
            <div key={f} className="panel">
              <div className="panel-head"><div><h5>{m.name}</h5><div className="text-muted" style={{ fontSize: 11 }}>{m.nameTh} · release {m.release}</div></div><span className="tag tag-neutral" style={{ fontSize: 10 }}>{byFeature.find((b) => b.f === f)?.n ?? 0} replies</span></div>
              <div className="panel-body" style={{ fontSize: 13 }}>
                {m.purpose}
                <div className="stack-actions" style={{ marginTop: 10 }}>
                  <Link href={m.href} className="btn btn-secondary" style={{ fontSize: 12 }}>Open</Link>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setCopilotOpen(true); void ai.ask(f === "quickscan" ? "Scan Siam Verdant Foods" : f === "specialist" ? "What is the QDMTT safe harbour and does it apply to us?" : f === "explain" ? "Why is the Vietnam top-up what it is?" : f === "strategy" ? "What if we extend the BOI holiday?" : f === "briefing" ? "Draft the CFO briefing" : f === "trainer" ? "What is the next step?" : f === "feedback" ? "The ETR map tooltip overlaps the legend on mobile" : f === "interviewer" ? "What do you need from me?" : f === "reviewer" ? "Review the calculation" : f === "rehearsal" ? "What would the RD ask about Ireland?" : "What changed in the rules?", { feature: f }); }}>Ask</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>AI audit log</h5><span className="tag tag-neutral">{ai.state.audit.length}</span></div>
          <div className="table-wrap"><table className="table" style={{ fontSize: 12 }}><thead><tr><th>When</th><th>Kind</th><th>Feature</th><th>Actor</th><th>Summary</th></tr></thead><tbody>
            {ai.state.audit.slice(0, 30).map((a) => <tr key={a.id}><td className="text-muted">{a.at.slice(5, 16).replace("T", " ")}</td><td><span className={`tag ${a.kind === "refused" ? "tag-hot" : a.kind === "approval" || a.kind === "action" ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 10 }}>{a.kind}</span></td><td>{a.feature}</td><td>{a.actor} · {a.role}</td><td>{a.summary}</td></tr>)}
            {!ai.state.audit.length && <tr><td colSpan={5} className="text-muted">No interactions recorded yet.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h5>Try on this screen</h5></div>
          <div className="panel-body stack-actions">{suggestionsFor("general", ai.lang).map((s) => <button key={s} className="chip" onClick={() => { setCopilotOpen(true); void ai.ask(s); }}>{s}</button>)}</div>
          <div className="panel-body text-muted" style={{ fontSize: 12, borderTop: "2px solid var(--color-divider)" }}>
            Action policy: explain and navigate run within your access; drafts are labelled; saves follow review rules; approvals need an authorised reviewer; external submissions are never executed here.
          </div>
        </div>
      </div>
    </div>
  );
}
