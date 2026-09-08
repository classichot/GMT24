"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { taskTag } from "@/lib/ai/tasks";

const AREAS = ["all", "mapping", "reconciliation", "treatment", "elections", "movement", "evidence"] as const;
const OWNERS = ["Preparer", "Reviewer", "Tax manager", "Data owner", "Group tax"];

export default function ReviewerPage() {
  const ai = useAi();
  const { patchWorkflow, workflow, setCopilotOpen } = useStore();
  const [area, setArea] = useState<(typeof AREAS)[number]>("all");
  const [kind, setKind] = useState<"all" | "validation" | "suspected">("all");
  const [reason, setReason] = useState<Record<string, string>>({});
  const rows = ai.reviewFindings.filter((f) => (area === "all" || f.area === area) && (kind === "all" || f.kind === kind));
  const taskFor = (id: string) => ai.tasks.find((t) => t.id === `task:reviewer:${id}`);
  const act = (id: string, actionId: "resolve-task" | "dismiss-task" | "reopen-task", extra: Record<string, string> = {}) => ai.run(propose(actionId, { id: `task:reviewer:${id}`, reason: reason[id] ?? "", ...extra }, ai.ctx));
  const assign = (id: string, owner: string) => ai.run(propose("assign-task", { id: `task:reviewer:${id}`, owner }, ai.ctx));
  const open = ai.reviewFindings.filter((f) => (taskFor(f.id)?.status ?? "open") === "open" || taskFor(f.id)?.status === "assigned");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Validation checks</div><div className="kpi-val">{ai.reviewFindings.filter((f) => f.kind === "validation").length}</div><div className="kpi-sub">deterministic · fail = block or warn</div></div>
        <div className="kpi"><div className="kpi-label">Suspected issues</div><div className="kpi-val">{ai.reviewFindings.filter((f) => f.kind === "suspected").length}</div><div className="kpi-sub">investigation · a question, not a verdict</div></div>
        <div className="kpi"><div className="kpi-label">Open</div><div className="kpi-val">{open.length}</div><div className={`kpi-sub${open.some((f) => f.severity === "block") ? " hot" : ""}`}>{open.filter((f) => f.severity === "block").length} blocking</div></div>
        <div className="kpi"><div className="kpi-label">Reviewer run</div><div className="kpi-val" style={{ fontSize: 22 }}>{workflow.reviewerRan ? "recorded" : "not yet"}</div><div className="kpi-sub"><button className="btn btn-ghost" style={{ fontSize: 11, padding: 0 }} onClick={() => { patchWorkflow({ reviewerRan: true }); setCopilotOpen(true); void ai.ask("Review the calculation", { feature: "reviewer" }); }}>Run against {ai.ctx.calcVersion.split(" · ")[0]}</button></div></div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <div><h5>Findings</h5><div className="text-muted" style={{ fontSize: 11 }}>What was checked · expected · actual · the question to answer. Every finding is a task; dismissal needs a reason that stays on record.</div></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AREAS.map((a) => <button key={a} className={`chip${area === a ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setArea(a)}>{a}</button>)}
            <span style={{ width: 8 }} />
            {(["all", "validation", "suspected"] as const).map((k) => <button key={k} className={`chip${kind === k ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setKind(k)}>{k}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Sev</th><th>Kind · area</th><th>Finding</th><th>Checked / expected / actual</th><th>Question</th><th>Owner · status</th><th>Resolution</th></tr></thead>
            <tbody>
              {rows.map((f) => { const t = taskFor(f.id); const st = t?.status ?? "open"; return (
                <tr key={f.id} style={{ opacity: st === "resolved" || st === "dismissed" ? 0.6 : 1 }}>
                  <td><span className={`tag ${f.severity === "block" ? "tag-hot" : f.severity === "warn" ? "tag-warn" : "tag-neutral"}`} style={{ fontSize: 10 }}>{f.severity}</span></td>
                  <td><div>{f.kind}</div><div className="text-muted">{f.area}</div></td>
                  <td><strong>{f.title}</strong>{f.href && <div><Link href={f.href} style={{ fontSize: 11 }}>Open screen</Link></div>}</td>
                  <td><div>{f.checked}</div><div className="text-muted">Expected: {f.expected}</div><div className="text-muted">Actual: {f.actual}</div></td>
                  <td>{f.question}</td>
                  <td>
                    <select className="input" style={{ minHeight: 0, padding: "2px 6px", fontSize: 11, width: "auto" }} value={t?.owner ?? f.owner} onChange={(e) => assign(f.id, e.target.value)}>{[...new Set([f.owner, ...OWNERS])].map((o) => <option key={o}>{o}</option>)}</select>
                    <div style={{ marginTop: 4 }}><span className={`tag ${taskTag(st)}`} style={{ fontSize: 10 }}>{st}</span>{t?.resolution?.reason ? <div className="text-muted">{t.resolution.reason} — {t.resolution.by}</div> : null}</div>
                  </td>
                  <td>
                    {st === "resolved" || st === "dismissed" ? <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => act(f.id, "reopen-task")}>Reopen</button> : (
                      <div style={{ display: "grid", gap: 4 }}>
                        <input className="input" style={{ minHeight: 0, padding: "3px 6px", fontSize: 11 }} placeholder="Reason…" value={reason[f.id] ?? ""} onChange={(e) => setReason((r) => ({ ...r, [f.id]: e.target.value }))} />
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => act(f.id, "resolve-task")}>Resolve</button>
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => act(f.id, "dismiss-task")} title="Requires approve-treatment and a reason">Dismiss</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ); })}
              {!rows.length && <tr><td colSpan={7} className="text-muted">No findings in this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 12 }}>The reviewer does not change any number. Validation checks are deterministic; suspected issues are hypotheses to be confirmed or dismissed by a person. Findings feed the shared <Link href="/tasks">task list</Link> and the CFO briefing. Full path: <Link href="/playbook/copilot">AI Co-Pilot playbook</Link>.</div>
    </div>
  );
}
