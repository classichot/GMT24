"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { categorise, draftTicket, findDuplicate } from "@/lib/ai/feedback";
import type { Ticket, TicketCategory } from "@/lib/ai/types";

const STATUS: Ticket["status"][] = ["new", "triaged", "in-progress", "resolved"];
const CATEGORY_LABEL: Record<TicketCategory, string> = { bug: "Bug", usability: "Usability", feature: "Feature request", data: "Data", question: "Question" };

function statusTag(s: Ticket["status"]) {
  return s === "resolved" ? "tag-ok" : s === "in-progress" ? "tag-accent" : s === "triaged" ? "tag-outline" : "tag-warn";
}
function sevTag(s: Ticket["severity"]) {
  return s === "critical" || s === "high" ? "tag-hot" : s === "medium" ? "tag-warn" : "tag-neutral";
}

export default function FeedbackPage() {
  const ai = useAi();
  const { flash } = useStore();
  const [text, setText] = useState("");
  const [include, setInclude] = useState({ screen: true, versions: true, steps: true });
  const [preview, setPreview] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState<"open" | "all" | Ticket["status"]>("open");
  const [note, setNote] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const guess = text.trim().length > 8 ? categorise(text) : null;
  const dup = text.trim().length > 8 ? findDuplicate(text, ai.state.tickets) : null;

  const tickets = ai.state.tickets;
  const rows = tickets.filter((t) => (filter === "all" ? true : filter === "open" ? t.status !== "resolved" : t.status === filter));
  const byCategory = useMemo(() => (Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((c) => [c, tickets.filter((t) => t.category === c).length] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]), [tickets]);
  const byScreen = useMemo(() => Object.entries(tickets.reduce<Record<string, number>>((m, t) => ({ ...m, [t.screen]: (m[t.screen] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5), [tickets]);
  const resolvedDays = useMemo(() => {
    const done = tickets.filter((t) => t.status === "resolved");
    if (!done.length) return null;
    const ms = done.reduce((s, t) => { const last = t.updates[t.updates.length - 1]?.at ?? t.createdAt; return s + (new Date(last).getTime() - new Date(t.createdAt).getTime()); }, 0) / done.length;
    return Math.round((ms / 86400000) * 10) / 10;
  }, [tickets]);

  const draft = () => {
    if (text.trim().length < 8) { flash("Describe the issue in a sentence or two."); return; }
    setPreview(draftTicket(text, ai.ctx, tickets, include, ai.ctx.user.name));
  };
  const submit = () => {
    if (!preview) return;
    const res = ai.submitTicket(preview);
    if (res.ok) { setText(""); setPreview(null); setFilter("open"); }
  };
  const setStatus = (t: Ticket, s: Ticket["status"]) => { ai.updateTicket(t.id, { status: s, note: note[t.id]?.trim() || `Status → ${s}` }); setNote((n) => ({ ...n, [t.id]: "" })); };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Open tickets</div><div className="kpi-val">{tickets.filter((t) => t.status !== "resolved").length}</div><div className={`kpi-sub${tickets.some((t) => t.status !== "resolved" && (t.severity === "high" || t.severity === "critical")) ? " hot" : ""}`}>{tickets.filter((t) => t.status !== "resolved" && (t.severity === "high" || t.severity === "critical")).length} high or critical</div></div>
        <div className="kpi"><div className="kpi-label">Resolved</div><div className="kpi-val">{tickets.filter((t) => t.status === "resolved").length}</div><div className="kpi-sub">{resolvedDays == null ? "no resolution time yet" : `avg ${resolvedDays} days to resolve`}</div></div>
        <div className="kpi"><div className="kpi-label">Top category</div><div className="kpi-val" style={{ fontSize: 22 }}>{byCategory[0] ? CATEGORY_LABEL[byCategory[0][0]] : "—"}</div><div className="kpi-sub">{byCategory.map(([c, n]) => `${CATEGORY_LABEL[c]} ${n}`).join(" · ") || "no tickets yet"}</div></div>
        <div className="kpi"><div className="kpi-label">Most reported screen</div><div className="kpi-val" style={{ fontSize: 22 }}>{byScreen[0]?.[0] ?? "—"}</div><div className="kpi-sub">{byScreen.slice(0, 3).map(([s, n]) => `${s} ${n}`).join(" · ") || "—"}</div></div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)" }}>
        <div className="panel">
          <div className="panel-head"><div><h5>Report an issue or idea</h5><div className="text-muted" style={{ fontSize: 11 }}>Thai or English. The collector drafts a reproducible ticket; you see exactly what context is attached before anything is submitted.</div></div></div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>
            <textarea className="input" rows={5} style={{ fontSize: 13 }} placeholder="What happened, what you expected, where you were… / เกิดอะไรขึ้น คาดหวังอะไร อยู่หน้าไหน" value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              {guess && <><span className={`tag tag-outline`} style={{ fontSize: 10 }}>{CATEGORY_LABEL[guess.category]}</span><span className={`tag ${sevTag(guess.severity)}`} style={{ fontSize: 10 }}>{guess.severity}</span></>}
              {dup && <span className="tag tag-warn" style={{ fontSize: 10 }}>possible duplicate of {dup.ref}</span>}
            </div>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Context to include</div>
            <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={include.screen} onChange={(e) => setInclude({ ...include, screen: e.target.checked })} /> Screen ({ai.ctx.path})</label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={include.versions} onChange={(e) => setInclude({ ...include, versions: e.target.checked })} /> App and calculation version ({ai.ctx.appVersion} · {ai.ctx.calcVersion})</label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={include.steps} onChange={(e) => setInclude({ ...include, steps: e.target.checked })} /> Reproduction steps from the current context</label>
              <div className="text-muted" style={{ fontSize: 11 }}>Never included: tax figures, entity data, attachments.</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={draft} disabled={text.trim().length < 8}>Preview ticket</button>
              {preview && <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={submit}>Submit {preview.ref}</button>}
            </div>
            {preview && (
              <div className="reply-preview" style={{ fontSize: 12 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><strong>{preview.ref}</strong><span className="tag tag-outline" style={{ fontSize: 10 }}>{CATEGORY_LABEL[preview.category]}</span><span className={`tag ${sevTag(preview.severity)}`} style={{ fontSize: 10 }}>{preview.severity}</span>{preview.duplicateOf && <span className="tag tag-warn" style={{ fontSize: 10 }}>links to {preview.duplicateOf}</span>}</div>
                <div style={{ marginTop: 4 }}><strong>{preview.title}</strong></div>
                <ol style={{ margin: "6px 0", paddingLeft: 18 }}>{preview.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                <div className="text-muted">Included: {preview.contextIncluded.join(", ") || "nothing"} · Excluded: {preview.contextExcluded.join(", ")}</div>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head" style={{ flexWrap: "wrap" }}>
            <div><h5>Tracker</h5><div className="text-muted" style={{ fontSize: 11 }}>Every ticket has a reference number and a visible status. Reporters see what happened to their report.</div></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["open", ...STATUS, "all"] as const).map((f) => <button key={f} className={`chip${filter === f ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setFilter(f)}>{f}</button>)}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table" style={{ fontSize: 12 }}>
              <thead><tr><th>Ref</th><th>Ticket</th><th>Category · sev</th><th>Screen · version</th><th>Reporter</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const isOpen = openId === t.id;
                  return (
                    <tr key={t.id} style={{ verticalAlign: "top" }}>
                      <td><strong>{t.ref}</strong><div className="text-muted" style={{ fontSize: 10 }}>{t.createdAt.slice(0, 10)}</div></td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ cursor: "pointer" }} onClick={() => setOpenId(isOpen ? null : t.id)}><strong>{t.title}</strong>{t.duplicateOf && <span className="tag tag-warn" style={{ fontSize: 10, marginLeft: 6 }}>dup of {t.duplicateOf}</span>}</div>
                        {isOpen && (
                          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                            <div className="passage">{t.description}</div>
                            <ol style={{ margin: 0, paddingLeft: 18 }}>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                            <div className="text-muted" style={{ fontSize: 11 }}>Included: {t.contextIncluded.join(", ") || "nothing"} · Excluded: {t.contextExcluded.join(", ")}</div>
                            <div style={{ display: "grid", gap: 2 }}>{t.updates.map((u, i) => <div key={i} className="text-muted" style={{ fontSize: 11 }}>{u.at.slice(0, 16).replace("T", " ")} — {u.note}</div>)}</div>
                          </div>
                        )}
                      </td>
                      <td><span className="tag tag-outline" style={{ fontSize: 10 }}>{CATEGORY_LABEL[t.category]}</span><div><span className={`tag ${sevTag(t.severity)}`} style={{ fontSize: 10, marginTop: 4 }}>{t.severity}</span></div></td>
                      <td className="text-muted" style={{ fontSize: 11 }}>{t.screen}<div>{t.appVersion}</div><div>{t.calcVersion}</div></td>
                      <td>{t.reporter}<div className="text-muted" style={{ fontSize: 10 }}>{t.lang.toUpperCase()}</div></td>
                      <td>
                        <span className={`tag ${statusTag(t.status)}`} style={{ fontSize: 10 }}>{t.status}</span>
                        {isOpen && (
                          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                            <input className="input" style={{ minHeight: 0, padding: "3px 6px", fontSize: 11 }} placeholder="Update note…" value={note[t.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [t.id]: e.target.value }))} />
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {STATUS.filter((s) => s !== t.status).map((s) => <button key={s} className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => setStatus(t, s)}>{s}</button>)}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={6} className="text-muted">{tickets.length ? "No tickets in this filter." : "No tickets yet. Describe an issue on the left, or tell the Co-Pilot \"this is wrong\" from any screen."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="text-muted" style={{ fontSize: 12 }}>Aggregated reporting above (category, screen, resolution time) is computed from the tickets in this workspace. Duplicate detection runs before submission so recurring issues link to one ticket instead of splitting.</div>
    </div>
  );
}
