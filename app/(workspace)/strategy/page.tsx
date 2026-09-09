"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { useAi } from "@/components/AiProvider";
import { ReplyView } from "@/components/ai/ReplyView";
import { propose } from "@/lib/ai/actions";
import { etrPct, eur } from "@/lib/format";
import type { Reply } from "@/lib/ai/types";

const EXAMPLES = ["What if we extend the BOI holiday?", "What if we convert the BOI holiday to a 10% rate?", "What if Thai payroll rises by $2m?", "What if the Ireland TP margin drops to 2%?", "Turn on the Art. 3.2.2 stock-comp election in Thailand and claim no SBIE in Vietnam"];

export default function StrategyPage() {
  const ai = useAi();
  const [q, setQ] = useState("");
  const [last, setLast] = useState<Reply | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const run = async (text: string) => { setQ(""); const r = await ai.ask(text, { feature: "strategy" }); setLast(r); };
  const sc = ai.state.scenarios;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="callout">
        <strong>Ask in plain language; the engine runs the scenario.</strong>
        <div className="text-muted" style={{ marginTop: 4 }}>The question is translated into explicit assumptions (elections, SBIE claims, simulator inputs), screened for eligibility and five-year locks, run through GMT24-CALC against the current working package, and saved as a draft. Adoption goes through the reviewer gateway and is written to Evidence history. The approved calculation is never touched.</div>
      </div>
      <form className="panel" onSubmit={(e) => { e.preventDefault(); if (q.trim()) void run(q); }}>
        <div className="panel-body" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What if we…" />
            <button className="btn btn-primary" type="submit" disabled={ai.busy}><ArrowUp size={16} /></button>
          </div>
          <div className="stack-actions">{EXAMPLES.map((x) => <button key={x} type="button" className="chip" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => void run(x)}>{x}</button>)}</div>
        </div>
      </form>
      {last && <div className="panel"><div className="panel-body"><ReplyView reply={last} /></div></div>}

      <div className="panel">
        <div className="panel-head"><h5>Saved scenarios</h5><span className="tag tag-neutral">{sc.length}</span></div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 12 }}>
            <thead><tr><th>Status</th><th>Scenario</th><th className="num">Base top-up</th><th className="num">Scenario</th><th className="num">Δ</th><th>Assumptions</th><th>Rule / calc version</th><th></th></tr></thead>
            <tbody>
              {sc.map((s) => (
                <>
                  <tr key={s.id} className="clickable" onClick={() => setOpen(open === s.id ? null : s.id)}>
                    <td><span className={`tag ${s.status === "adopted" ? "tag-ok" : s.status === "proposed" ? "tag-outline" : s.status === "rejected" ? "tag-neutral" : "tag-warn"}`} style={{ fontSize: 10 }}>{s.status}</span></td>
                    <td><strong>{s.title}</strong><div className="text-muted">{s.question}</div></td>
                    <td className="num">{eur(s.baseTopUp)}</td><td className="num">{eur(s.topUp)}</td>
                    <td className="num" style={{ color: s.topUp - s.baseTopUp < 0 ? "var(--color-accent-700)" : s.topUp - s.baseTopUp > 0 ? "var(--color-hot)" : undefined }}>{eur(s.topUp - s.baseTopUp)}</td>
                    <td>{s.assumptions.slice(0, 2).join("; ")}{s.assumptions.length > 2 ? "…" : ""}</td>
                    <td className="text-muted">{s.ruleVersion}<div>{s.calcVersion}</div></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {s.status === "draft" && <button className="btn btn-secondary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => ai.run(propose("save-scenario", { id: s.id }, ai.ctx))}>Propose</button>}
                        {(s.status === "draft" || s.status === "proposed") && <button className="btn btn-primary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => ai.run(propose("adopt-scenario", { id: s.id }, ai.ctx))} title="Requires adopt-scenario permission">Adopt</button>}
                      </div>
                    </td>
                  </tr>
                  {open === s.id && (
                    <tr key={`${s.id}-d`}><td colSpan={8} style={{ background: "var(--color-surface)" }}>
                      <div className="grid-3" style={{ fontSize: 12 }}>
                        <div>
                          <div className="reply-label">By jurisdiction</div>
                          <table className="table" style={{ fontSize: 11 }}><thead><tr><th>Jur</th><th className="num">ETR</th><th className="num">Top-up</th><th>Payer</th></tr></thead><tbody>{s.rows.filter((r) => r.topUp || r.baseTopUp).map((r) => <tr key={r.blendKey}><td>{r.name}</td><td className="num">{etrPct({ etr: r.baseEtr, globeIncome: r.baseGlobe ?? 1 }, 1)} → {etrPct({ etr: r.etr, globeIncome: r.globe ?? 1 }, 1)}</td><td className="num">{eur(r.baseTopUp)} → {eur(r.topUp)}</td><td>{r.payer}</td></tr>)}</tbody></table>
                        </div>
                        <div>
                          <div className="reply-label">Multi-year</div>
                          <table className="table" style={{ fontSize: 11 }}><thead><tr><th>FY</th><th className="num">Base</th><th className="num">Scenario</th><th>Note</th></tr></thead><tbody>{s.multiYear.map((m) => <tr key={m.fy}><td>{m.fy}</td><td className="num">{eur(m.base)}</td><td className="num">{eur(m.scenario)}</td><td className="text-muted">{m.note}</td></tr>)}</tbody></table>
                          <div className="reply-label" style={{ marginTop: 8 }}>Sensitivity</div>
                          <ul style={{ margin: 0, paddingLeft: 16 }}>{s.sensitivity.map((x) => <li key={x.label}>{x.label}: {eur(x.topUp)} ({x.delta >= 0 ? "+" : ""}{eur(x.delta)})</li>)}</ul>
                        </div>
                        <div>
                          <div className="reply-label">Assumptions</div><ul style={{ margin: 0, paddingLeft: 16 }}>{s.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                          <div className="reply-label" style={{ marginTop: 8 }}>Eligibility</div><ul style={{ margin: 0, paddingLeft: 16 }}>{s.eligibility.length ? s.eligibility.map((e) => <li key={e.key}>{e.key}: {e.status} — {e.reason}</li>) : <li className="text-muted">No elections in this scenario</li>}</ul>
                          <div className="reply-label" style={{ marginTop: 8 }}>Compliance</div><ul style={{ margin: 0, paddingLeft: 16 }}>{s.compliance.map((c, i) => <li key={i}>{c}</li>)}</ul>
                          <div className="text-muted" style={{ marginTop: 8 }}>Created {s.createdAt.slice(0, 16).replace("T", " ")} by {s.createdBy}{s.adoptedBy ? ` · adopted by ${s.adoptedBy} ${s.adoptedAt?.slice(0, 10)}` : ""}</div>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
              {!sc.length && <tr><td colSpan={8} className="text-muted">No scenarios yet — ask a what-if above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
