"use client";

import { useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { thaiLiability, thaiUtprAllocation, THAI_PACK } from "@/lib/thailand";

export default function ThaiLiabilityPage() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const th = calcs.find((c) => c.iso === "TH");
  const [payer, setPayer] = useState<"statutory" | "thce">("thce");
  if (!th) return null;
  const L = thaiLiability(th);
  const utpr = thaiUtprAllocation();
  const statutoryTotal = L.statutory.reduce((a, r) => a + r.statutory, 0);
  const elected = payer === "thce"
    ? L.statutory.map((r) => ({ ...r, due: r.id === "TH-CE" ? L.payable : 0 }))
    : L.statutory.map((r) => ({ ...r, due: r.statutory }));

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Thai Tax Rule Ordering Engine.</strong> Reconciles Thai QDMTT, Thai IIR, Thai UTPR, foreign reductions and the amount each Thai entity must pay. Prevents double collection. Formula:{" "}
          <span className="mono">Top-up − foreign QDMTT − IIR already imposed = residual UTPR → Thailand allocation → liable entity</span>
        </div>
        <div className="stack-actions">
          <Link href="/allocation" className="btn btn-secondary">Global who-pays</Link>
          <Link href="/thailand/filing" className="btn btn-secondary">Filing</Link>
          <button className="btn btn-primary" onClick={() => ask("Who pays the Thai QDMTT and is there residual UTPR?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="grid-split" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Thai liability waterfall</h4>
            <span className="tag tag-accent">{THAI_PACK.engine}</span>
          </div>
          <div className="panel-body waterfall">
            <div className="wf-row">
              <span>Jurisdictional Top-up Tax<div className="text-muted" style={{ fontSize: 12 }}>GMT24 Global GloBE Core · Art. 5.2.3</div></span>
              <Amount n={L.jurisdictionalTopUp} audit={th.audit} />
            </div>
            <div className="wf-row">
              <span>− Foreign QDMTT<div className="text-muted" style={{ fontSize: 12 }}>Emergency Decree · this is the QDMTT jurisdiction</div></span>
              <Amount n={L.foreignQdmtt} audit={L.audit.children?.[1]} />
            </div>
            <div className="wf-row">
              <span>− IIR already imposed<div className="text-muted" style={{ fontSize: 12 }}>{L.iirNote}</div></span>
              <Amount n={L.iirAlready} audit={L.audit.children?.[2]} />
            </div>
            <div className="wf-row">
              <span>Residual UTPR<div className="text-muted" style={{ fontSize: 12 }}>{L.utprNote}</div></span>
              <Amount n={L.residualUtpr} audit={L.audit.children?.[3]} />
            </div>
            <div className="wf-row">
              <span>Thai QDMTT collects<div className="text-muted" style={{ fontSize: 12 }}>TH-QDMTT-2025 · Central Record transitional qualified</div></span>
              <Amount n={L.thaiQdmtt} audit={th.audit} />
            </div>
            <div className="wf-row total">
              <span>Amount ultimately payable in Thailand</span>
              <Amount n={L.payable} audit={L.audit} />
            </div>
          </div>
          <div className="alloc" style={{ padding: "0 16px 16px" }}>
            {L.path.map((p, i) => (
              <div key={p}>
                <div className="alloc-box"><strong>{p}</strong></div>
                {i < L.path.length - 1 && <div className="alloc-arrow">↓</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h4>Designated taxpayer election</h4>
            <span className="text-muted">Written agreement · joint and several remains</span>
          </div>
          <div className="panel-body">
            <p className="text-muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
              Thai CEs may agree in writing that one or more entities bear Thai domestic top-up and/or Thailand’s UTPR allocation. Statutory fallback is GloBE-profit share. Cash moves; the RD can still collect from any Thai CE.
            </p>
            <div className="stack-actions" style={{ marginBottom: 12 }}>
              <button type="button" className={`btn ${payer === "statutory" ? "btn-primary" : "btn-secondary"}`} onClick={() => setPayer("statutory")}>Statutory (GloBE profit)</button>
              <button type="button" className={`btn ${payer === "thce" ? "btn-primary" : "btn-secondary"}`} onClick={() => setPayer("thce")}>TH001 sole payer</button>
            </div>
            {elected.map((r) => (
              <div className="wf-row" key={r.id}>
                <span>{r.name}<div className="text-muted" style={{ fontSize: 12 }}>GloBE {eur(r.globe, true)} · statutory {pct(r.share, 1)}</div></span>
                <strong>{eur(r.due)}</strong>
              </div>
            ))}
            <div className="wf-row total"><span>Thai payable</span><Amount n={L.payable} audit={L.audit} /></div>
            <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 12 }}>
              Intercompany settlement {payer === "thce" ? `${eur(statutoryTotal - (elected.find((e) => e.id === "TH-CE")?.due ?? 0) + (elected.find((e) => e.id === "TH-PE")?.statutory ?? 0))} PE → TH001` : "none — each pays its share"}.
              Notification of the election travels with the Section 57 return. Filing schema pending.
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>Thai UTPR allocation dataset · Notification No. 5</h4>
          <a href={THAI_PACK.oecdCentralRecord} className="btn btn-ghost" target="_blank" rel="noreferrer">OECD Central Record</a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Jurisdiction</th><th className="num">FTE</th><th className="num">Tangible assets</th><th>Qualifies</th><th>Note</th></tr></thead>
            <tbody>
              {utpr.qualifying.map((r) => (
                <tr key={r.iso}>
                  <td>{r.name}</td>
                  <td className="num">{r.fte.toLocaleString("en-GB")}</td>
                  <td className="num">{eur(r.assets, true)}</td>
                  <td>{r.qualifies ? "Yes" : "No"}</td>
                  <td style={{ fontSize: 12 }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ padding: "12px 16px 16px", margin: 0, fontSize: 13 }}>
          {utpr.method}. Counting: {utpr.counting}. Investment entities excluded. Thai FTE and assets are locked for FY2026 even though Thailand does not collect UTPR this year. Residual worldwide UTPR in this snapshot is $0 after QDMTT / IIR.
        </p>
      </div>
    </div>
  );
}
