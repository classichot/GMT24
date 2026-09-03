"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ScanLine, ShieldCheck } from "lucide-react";
import { FlowBar } from "@/components/FlowBar";
import { ScoreBar, SeverityTag, StatusTag } from "@/components/XrayBits";
import { useStore } from "@/lib/store";
import { useXray } from "@/lib/useXray";
import { eur } from "@/lib/format";
import {
  ENGINE_META,
  amountAtRisk,
  type XrayEngineId,
} from "@/lib/xray";

const ENGINE_ORDER: XrayEngineId[] = [
  "dividend",
  "payroll",
  "asset",
  "boi",
  "deferred",
  "covered",
  "entity",
  "election",
];

export default function XrayPage() {
  const { resetXray, ask, flash, group } = useStore();
  const { findings, statuses, areas, byEngine, byJurisdiction, overall, stop, calcs } = useXray();
  const router = useRouter();
  const [engine, setEngine] = useState<XrayEngineId | "all">("all");

  const rows = useMemo(() => {
    const list = engine === "all" ? findings : findings.filter((f) => f.engine === engine);
    return [...list]
      .map((f) => ({ f, risk: amountAtRisk(f, calcs), status: statuses[f.id] }))
      .sort((a, b) => {
        const openA = a.status === "resolved" ? 1 : 0;
        const openB = b.status === "resolved" ? 1 : 0;
        return openA - openB || b.risk - a.risk;
      });
  }, [findings, engine, statuses, calcs]);

  return (
    <div>
      <FlowBar />

      <div
        className="callout"
        style={{
          marginBottom: 16,
          borderLeft: `4px solid ${stop.blocked ? "var(--color-hot)" : "var(--color-ok)"}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}>
            {stop.blocked ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            {stop.label}
          </div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>
            X-Ray sits between the data and the calculation. A trial balance carries the amount but never the
            legal characteristics the GloBE rules turn on, so every detection below is a fact the source data
            cannot prove on its own. Find the missing facts, route them to the responsible team, validate the
            evidence and prepare a calculation that can be defended.
          </div>
        </div>
        <div className="stack-actions">
          <Link href="/xray/confirm" className="btn btn-primary"><ScanLine size={16} />Confirmation workflow</Link>
          <button className="btn btn-ghost" onClick={() => { resetXray(); flash("X-Ray confirmations cleared"); }}>Reset</button>
          <button className="btn btn-ghost" onClick={() => ask("What is blocking the FY2026 close in Pillar Two X-Ray?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Overall confidence</div>
          <div className="kpi-val">{overall}%</div>
          <div className="kpi-sub">Weighted by the magnitude of each area</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Top-up at risk</div>
          <div className="kpi-val">{eur(stop.exposure, true)}</div>
          <div className="kpi-sub">Swing across unresolved answers</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Open detections</div>
          <div className="kpi-val">{stop.open}</div>
          <div className="kpi-sub">of {findings.length} across eight engines</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Material unresolved</div>
          <div className="kpi-val" style={{ color: stop.reasons.length ? "var(--color-hot)" : undefined }}>{stop.reasons.length}</div>
          <div className="kpi-sub">{stop.blocked ? "Final approval is blocked" : "Hard stop clear"}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Calculation confidence</h4>
            <span className="text-muted">{group.fy} · by calculation area</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Calculation area</th>
                  <th>Confidence</th>
                  <th className="num">Open</th>
                  <th className="num">At risk</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.key}>
                    <td>{a.label}</td>
                    <td><ScoreBar score={a.score} /></td>
                    <td className="num">{a.open} / {a.total}</td>
                    <td className="num">{a.atRisk ? eur(a.atRisk, true) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ background: "color-mix(in srgb, var(--color-accent-100) 60%, transparent)" }}>
                  <td style={{ fontWeight: 800 }}>Overall calculation</td>
                  <td><ScoreBar score={overall} /></td>
                  <td className="num" style={{ fontWeight: 800 }}>{stop.open} / {findings.length}</td>
                  <td className="num" style={{ fontWeight: 800 }}>{eur(stop.exposure, true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
              A score is severity weighted by how material the item is against its own area, then discounted as the
              confirmation progresses. Answering a question moves it, attaching evidence moves it further, and
              reviewer approval closes it.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h4>{stop.blocked ? "Hard stop — unresolved material items" : "Hard stop clear"}</h4>
            <Link href="/approvals" className="btn btn-ghost">Approvals</Link>
          </div>
          {stop.reasons.length ? (
            <>
              {stop.reasons.map((r) => (
                <Link
                  key={r.findingId}
                  href={`/xray/confirm?f=${r.findingId}`}
                  style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--color-divider)", textDecoration: "none", color: "inherit" }}
                >
                  <div>
                    <strong>{r.title}</strong>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{r.jurisdiction} · {r.reason}</div>
                  </div>
                  <span className="num" style={{ alignSelf: "center", flex: "none", fontWeight: 800 }}>{r.atRisk ? eur(r.atRisk, true) : "—"}</span>
                </Link>
              ))}
              <div className="panel-body">
                <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                  A provisional calculation still runs and every screen keeps working. Final approval on{" "}
                  <Link href="/approvals">Approvals</Link> is refused until each item above is confirmed, supported by
                  evidence and reviewed.
                </p>
              </div>
            </>
          ) : (
            <div className="panel-body">
              <p style={{ marginTop: 0 }}>
                Every material detection is confirmed, evidenced and reviewed. The calculation can be approved as
                final and the confirmations travel with it into the evidence chronicle.
              </p>
              <Link href="/approvals" className="btn btn-primary">Go to approvals</Link>
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Specialist X-Ray engines</h4>
          <span className="text-muted">Detection is rule driven — findings move with the data</span>
        </div>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {ENGINE_ORDER.map((id) => {
            const row = byEngine.find((r) => r.key === id);
            const count = row?.total ?? 0;
            const active = engine === id;
            return (
              <button
                key={id}
                onClick={() => setEngine(active ? "all" : id)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  padding: "14px 16px",
                  border: `2px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                  background: active ? "color-mix(in srgb, var(--color-accent-100) 70%, transparent)" : "transparent",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ fontSize: 13 }}>{ENGINE_META[id].name}</strong>
                  {row ? <ScoreBar score={row.score} width={54} /> : <span className="tag tag-accent">Clear</span>}
                </div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>{ENGINE_META[id].blurb}</div>
                <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                  {count ? `${row?.open ?? 0} open of ${count} detected` : "No detections"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>Blind-spot detection{engine === "all" ? "" : ` · ${ENGINE_META[engine].name}`}</h4>
          <span className="text-muted">{rows.length} item{rows.length === 1 ? "" : "s"} · ranked by top-up at risk</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Detected issue</th>
                <th>Entity</th>
                <th>Rule</th>
                <th>Missing information</th>
                <th className="num">Amount</th>
                <th className="num">Top-up at risk</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ f, risk, status }) => (
                <tr key={f.id} className="clickable" onClick={() => router.push(`/xray/confirm?f=${f.id}`)}>
                  <td style={{ maxWidth: 340 }}>
                    <div style={{ fontWeight: 700 }}>{f.title}</div>
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>{f.detected}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className="mono" style={{ fontSize: 12 }}>{f.entityCode}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{f.jurisdiction}</div>
                  </td>
                  <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{f.article}</td>
                  <td className="text-muted" style={{ fontSize: 12, maxWidth: 280 }}>{f.missing}</td>
                  <td className="num">{f.amount ? eur(f.amount, true) : "—"}</td>
                  <td className="num" style={{ fontWeight: 800 }}>{risk ? eur(risk, true) : "—"}</td>
                  <td><SeverityTag severity={f.severity} /></td>
                  <td><StatusTag status={status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Confidence by jurisdiction</h4>
            <Link href="/etr-map" className="btn btn-ghost">ETR map</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Jurisdiction</th>
                  <th>Confidence</th>
                  <th className="num">Open</th>
                  <th className="num">At risk</th>
                </tr>
              </thead>
              <tbody>
                {[...byJurisdiction].sort((a, b) => a.score - b.score).map((j) => (
                  <tr key={j.key}>
                    <td>{j.label}</td>
                    <td><ScoreBar score={j.score} width={90} /></td>
                    <td className="num">{j.open} / {j.total}</td>
                    <td className="num">{j.atRisk ? eur(j.atRisk, true) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Where X-Ray sits</h4>
            <Link href="/data" className="btn btn-ghost">Data Hub</Link>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, fontWeight: 700 }}>
              {["Trial balance & source data", "Pillar Two X-Ray", "Confirmation & evidence", "GloBE calculation", "Review & filing"].map((s, i) => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      padding: "6px 10px",
                      border: `2px solid ${i === 1 ? "var(--color-accent)" : "var(--color-divider)"}`,
                      background: i === 1 ? "var(--color-accent)" : "transparent",
                      color: i === 1 ? "var(--color-on-accent)" : "inherit",
                    }}
                  >
                    {s}
                  </span>
                  {i < 4 ? <span className="text-muted">→</span> : null}
                </span>
              ))}
            </div>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
              The calculation never becomes final while a material X-Ray item is unresolved. Confirmations, evidence
              links and both approvals are written to the{" "}
              <Link href="/evidence-history">evidence chronicle</Link>, so the answer that changed a number can be
              traced back to the person who gave it and the document that supported it.
            </p>
          </div>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        Detection reads the canonical model — trial-balance amounts, the entity register, the deferred-tax
        sub-ledger, incentive records and the source-file inventory. Change the data and the findings change with it.
        {" "}
        <Link href="/xray/confirm">Confirmation workflow</Link>
        {" · "}
        <Link href="/quality">Data quality</Link>
        {" · "}
        <Link href="/requests">Data requests</Link>
        {" · "}
        <Link href="/approvals">Approvals</Link>
      </p>
    </div>
  );
}
