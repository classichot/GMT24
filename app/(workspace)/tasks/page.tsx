"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { TASK_STATUS_LABEL, taskTag } from "@/lib/ai/tasks";
import type { Task, TaskSource, TaskStatus } from "@/lib/ai/types";

const SOURCE_LABEL: Record<TaskSource, string> = {
  issue: "Data quality", xray: "X-Ray", reviewer: "Reviewer", regwatch: "Regulatory", rehearsal: "Rehearsal", manual: "Manual", feedback: "Feedback", quickscan: "Quick Scan",
};
const OWNERS = ["Preparer", "Reviewer", "Tax manager", "Data owner", "Group tax", "Finance", "Legal"];
const STATUSES: ("open-all" | TaskStatus)[] = ["open-all", "open", "assigned", "resolved", "dismissed"];

export default function TasksPage() {
  const ai = useAi();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("open-all");
  const [source, setSource] = useState<TaskSource | "all">("all");
  const [owner, setOwner] = useState<string>("all");
  const [q, setQ] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; detail: string; owner: string; severity: Task["severity"]; due: string } | null>(null);

  const owners = useMemo(() => [...new Set([...OWNERS, ...ai.tasks.map((t) => t.owner)])].sort(), [ai.tasks]);
  const rows = useMemo(() => ai.tasks
    .filter((t) => (status === "open-all" ? t.status === "open" || t.status === "assigned" : t.status === status))
    .filter((t) => source === "all" || t.source === source)
    .filter((t) => owner === "all" || t.owner === owner)
    .filter((t) => !q.trim() || `${t.title} ${t.detail} ${t.iso ?? ""} ${t.entityId ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => sev(a) - sev(b) || (a.due ?? "9").localeCompare(b.due ?? "9")), [ai.tasks, status, source, owner, q]);

  const open = ai.tasks.filter((t) => t.status === "open" || t.status === "assigned");
  const overdue = open.filter((t) => t.due && t.due < new Date().toISOString().slice(0, 10));
  const bySource = Object.entries(open.reduce<Record<string, number>>((m, t) => ({ ...m, [t.source]: (m[t.source] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  const act = (t: Task, actionId: "resolve-task" | "dismiss-task" | "reopen-task") => ai.run(propose(actionId, { id: t.id, reason: reason[t.id] ?? "" }, ai.ctx));
  const assign = (t: Task, o: string) => ai.run(propose("assign-task", { id: t.id, owner: o }, ai.ctx));
  const create = () => {
    if (!draft || !draft.title.trim()) return;
    ai.run(propose("create-task", { title: draft.title.trim(), detail: draft.detail.trim(), owner: draft.owner, severity: draft.severity, href: "/tasks", source: "manual", ...(draft.due ? { due: draft.due } : {}) }, ai.ctx));
    setDraft(null);
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Open</div><div className="kpi-val">{open.length}</div><div className={`kpi-sub${open.some((t) => t.severity === "block") ? " hot" : ""}`}>{open.filter((t) => t.severity === "block").length} blocking · {open.filter((t) => t.status === "assigned").length} assigned</div></div>
        <div className="kpi"><div className="kpi-label">Overdue</div><div className="kpi-val">{overdue.length}</div><div className={`kpi-sub${overdue.length ? " hot" : ""}`}>{overdue.length ? `earliest ${overdue.map((t) => t.due!).sort()[0]}` : "nothing past due"}</div></div>
        <div className="kpi"><div className="kpi-label">Owners</div><div className="kpi-val">{new Set(open.map((t) => t.owner)).size}</div><div className="kpi-sub">{[...open.reduce<Map<string, number>>((m, t) => m.set(t.owner, (m.get(t.owner) ?? 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([o, n]) => `${o} ${n}`).join(" · ") || "—"}</div></div>
        <div className="kpi"><div className="kpi-label">By source</div><div className="kpi-val" style={{ fontSize: 22 }}>{bySource.length}</div><div className="kpi-sub">{bySource.slice(0, 3).map(([s, n]) => `${SOURCE_LABEL[s as TaskSource]} ${n}`).join(" · ") || "—"}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <div><h5>Tasks</h5><div className="text-muted" style={{ fontSize: 11 }}>One list from every source: data-quality issues, X-Ray confirmations, reviewer findings, regulatory reassessments, rehearsal gaps, Quick Scan follow-ups and manual tasks. Sources keep producing a task until the underlying fact is fixed — a dismissed task shows as dismissed rather than disappearing.</div></div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setDraft(draft ? null : { title: "", detail: "", owner: "Preparer", severity: "warn", due: "" })}><Plus size={13} /> New task</button>
        </div>
        {draft && (
          <div style={{ padding: "0 16px 12px", display: "grid", gap: 8, gridTemplateColumns: "2fr 3fr auto auto auto auto", alignItems: "end" }}>
            <label style={{ fontSize: 11 }}>Title<input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What needs doing" /></label>
            <label style={{ fontSize: 11 }}>Detail<input className="input" value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="Why, and what done looks like" /></label>
            <label style={{ fontSize: 11 }}>Owner<select className="input" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })}>{owners.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label style={{ fontSize: 11 }}>Severity<select className="input" value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as Task["severity"] })}><option value="block">block</option><option value="warn">warn</option><option value="info">info</option></select></label>
            <label style={{ fontSize: 11 }}>Due<input className="input" type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={create} disabled={!draft.title.trim()}>Create</button>
          </div>
        )}
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {STATUSES.map((s) => <button key={s} className={`chip${status === s ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setStatus(s)}>{s === "open-all" ? "Open + assigned" : TASK_STATUS_LABEL[s]}</button>)}
          <span style={{ width: 8 }} />
          <select className="input" style={{ minHeight: 0, padding: "3px 6px", fontSize: 11, width: "auto" }} value={source} onChange={(e) => setSource(e.target.value as TaskSource | "all")}><option value="all">All sources</option>{(Object.keys(SOURCE_LABEL) as TaskSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select>
          <select className="input" style={{ minHeight: 0, padding: "3px 6px", fontSize: 11, width: "auto" }} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="all">All owners</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
          <input className="input" style={{ minHeight: 0, padding: "3px 8px", fontSize: 11, width: 220 }} placeholder="Search title, detail, ISO, entity…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-muted" style={{ fontSize: 11, marginLeft: "auto" }}>{rows.length} of {ai.tasks.length}</span>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Sev</th><th>Source</th><th>Task</th><th>Where</th><th>Owner</th><th>Due</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((t) => {
                const done = t.status === "resolved" || t.status === "dismissed";
                const late = !done && t.due && t.due < new Date().toISOString().slice(0, 10);
                const isOpen = openId === t.id;
                return (
                  <tr key={t.id} style={{ opacity: done ? 0.6 : 1 }}>
                    <td><span className={`tag ${t.severity === "block" ? "tag-hot" : t.severity === "warn" ? "tag-warn" : "tag-neutral"}`} style={{ fontSize: 10 }}>{t.severity}</span></td>
                    <td><span className="tag tag-outline" style={{ fontSize: 10 }}>{SOURCE_LABEL[t.source]}</span>{t.source === "manual" || t.source === "quickscan" || t.source === "regwatch" || t.source === "rehearsal" ? <div className="text-muted" style={{ fontSize: 10 }}>AI proposal</div> : null}</td>
                    <td style={{ maxWidth: 380 }}>
                      <strong style={{ cursor: "pointer" }} onClick={() => setOpenId(isOpen ? null : t.id)}>{t.title}</strong>
                      <div className="text-muted" style={{ fontSize: 11, ...(isOpen ? {} : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 380 }) }}>{t.detail}</div>
                      {t.resolution?.reason && <div className="text-muted" style={{ fontSize: 11 }}>{t.status}: {t.resolution.reason} — {t.resolution.by}, {t.resolution.at.slice(0, 10)}</div>}
                    </td>
                    <td>{t.iso && <span className="tag tag-neutral" style={{ fontSize: 10, marginRight: 4 }}>{t.iso}</span>}{t.entityId && <span className="text-muted">{t.entityId}</span>}{t.href && <div><Link href={t.href} style={{ fontSize: 11 }}>Open</Link></div>}</td>
                    <td><select className="input" style={{ minHeight: 0, padding: "2px 6px", fontSize: 11, width: "auto" }} value={t.owner} disabled={done} onChange={(e) => assign(t, e.target.value)}>{[...new Set([t.owner, ...owners])].map((o) => <option key={o}>{o}</option>)}</select></td>
                    <td className={late ? "" : "text-muted"} style={late ? { color: "var(--color-hot)", fontWeight: 700 } : undefined}>{t.due ?? "—"}</td>
                    <td><span className={`tag ${taskTag(t.status)}`} style={{ fontSize: 10 }}>{TASK_STATUS_LABEL[t.status]}</span></td>
                    <td>
                      {done ? <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => act(t, "reopen-task")}>Reopen</button> : (
                        <div style={{ display: "grid", gap: 4 }}>
                          <input className="input" style={{ minHeight: 0, padding: "3px 6px", fontSize: 11 }} placeholder="Reason…" value={reason[t.id] ?? ""} onChange={(e) => setReason((r) => ({ ...r, [t.id]: e.target.value }))} />
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => act(t, "resolve-task")}>Resolve</button>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => act(t, "dismiss-task")} title="Requires approve-treatment and a reason">Dismiss</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="text-muted">No tasks match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 12 }}>Resolving records who and why; dismissing needs approve-treatment and a mandatory reason. Both stay on the record and feed the <Link href="/briefing">CFO briefing</Link> and <Link href="/rehearsal">Audit Rehearsal</Link> readiness.</div>
    </div>
  );
}

function sev(t: Task) { return t.severity === "block" ? 0 : t.severity === "warn" ? 1 : 2; }
