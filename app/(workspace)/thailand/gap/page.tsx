"use client";

import { useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { GAP_KIND_LABEL, GAP_PLAY, reviewOecdRdGap, type GapKind } from "@/lib/thaiGap";

const KIND_TAG: Record<GapKind, string> = {
  aligned: "tag-ok",
  overlay: "tag-accent",
  diverge: "tag-hot",
  pending: "tag-warn",
  "calc-gap": "tag-neutral",
};

const FILTERS: { id: "all" | GapKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "diverge", label: "Diverges" },
  { id: "pending", label: "RD pending" },
  { id: "calc-gap", label: "Core gap" },
  { id: "overlay", label: "Overlay" },
  { id: "aligned", label: "Aligned" },
];

export default function OecdRdGapPage() {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const th = calcs.find((c) => c.iso === "TH");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [sel, setSel] = useState("G-SBIE");
  if (!th) return null;
  const R = reviewOecdRdGap(th);
  const rows = filter === "all" ? R.items : R.items.filter((i) => i.kind === filter);
  const pick = rows.find((i) => i.id === sel) ?? rows[0] ?? R.items[0];

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>OECD vs Thai RD gap review.</strong> Pure OECD Model Rules and the GMT24 GloBE Core calculation are not the same artefact as Revenue Department Pillar Two requirements. This review scores each topic: aligned, Thai overlay, diverges, RD instrument pending, or Core data gap. Engine posted; the LLM does not invent a Thai difference.
        </div>
        <div className="stack-actions">
          <Link href="/playbook/oecd-rd-gap" className="btn btn-secondary">Playbook</Link>
          <Link href="/rulebook" className="btn btn-secondary">OECD rulebook</Link>
          <button className="btn btn-primary" onClick={() => ask("Where does the OECD calculation diverge from Thai RD Pillar Two requirements?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Review</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{R.headline}</div>
          <div className="kpi-sub">{R.pack} · {R.version} · {R.items.length} topics</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Scope tests</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{R.oecdScope} / {R.thaiScope}</div>
          <div className="kpi-sub">OECD USD · Thai BOT THB</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">SBIE delta (Thai − OECD)</div>
          <div className="kpi-val">{eur(R.sbieDelta, true)}</div>
          <div className="kpi-sub">OECD {eur(R.oecdSbie, true)} · Thai {eur(R.thaiSbieAmt, true)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Top-up vs Thai payable</div>
          <div className="kpi-val"><Amount n={R.payable} audit={th.audit} compact /></div>
          <div className="kpi-sub">Core {eur(R.topUp, true)} · QDMTT collects</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Topic register</h4>
          <div className="stack-actions">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className={`btn ${filter === f.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Area</th><th>OECD</th><th>Thai RD</th><th>Kind</th><th>Live finding</th></tr></thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="clickable" onClick={() => setSel(g.id)}>
                  <td>{g.area}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{g.oecdCite}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{g.rdCite}</td>
                  <td><span className={`tag ${KIND_TAG[g.kind]}`}>{GAP_KIND_LABEL[g.kind]}</span></td>
                  <td style={{ fontSize: 12 }}>{g.finding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pick && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-head"><h4>OECD Core · {pick.area}</h4><span className="tag tag-outline">{pick.oecdCite}</span></div>
            <div className="panel-body">
              <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>{pick.oecd}</p>
              <div className="wf-row"><span>GMT24 GloBE Core</span><span style={{ maxWidth: 360, textAlign: "right" }}>{pick.core}</span></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h4>Thai RD · {pick.area}</h4><span className={`tag ${KIND_TAG[pick.kind]}`}>{GAP_KIND_LABEL[pick.kind]}</span></div>
            <div className="panel-body">
              <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>{pick.rd}</p>
              <div className="wf-row"><span>Cite</span><span>{pick.rdCite}</span></div>
              <div className="wf-row"><span>Thai pack</span><span style={{ maxWidth: 360, textAlign: "right" }}>{pick.pack}</span></div>
              <div className="wf-row total"><span>Action</span><span style={{ maxWidth: 360, textAlign: "right" }}>{pick.action}</span></div>
              <div className="stack-actions" style={{ marginTop: 12 }}>
                <Link href={pick.href} className="btn btn-primary">Open module</Link>
                <Link href="/playbook/oecd-rd-gap" className="btn btn-secondary">Step {pick.play}</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h4>Playbook · close the gap before filing</h4>
          <Link href="/playbook/oecd-rd-gap" className="btn btn-ghost">Full playbook</Link>
        </div>
        {GAP_PLAY.map((s) => (
          <div key={s.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 16, alignItems: "start", padding: "18px 20px", borderBottom: "1px solid var(--color-divider)" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: "var(--color-accent)" }}>{s.n}</div>
            <div>
              <h4 style={{ margin: 0 }}>{s.title}</h4>
              <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{s.body}</p>
            </div>
            <Link href={s.href} className="btn btn-primary">{s.hrefLabel}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
