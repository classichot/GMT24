"use client";

import { useState } from "react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { useCalc } from "@/lib/useCalc";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import { THAI_PACK } from "@/lib/thailand";
import { GAP_KIND_LABEL, GAP_PLAY, GAP_REF_SIDE, reviewOecdRdGap, type GapKind, type GapRef } from "@/lib/thaiGap";

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

function RefLink({ r, className }: { r: GapRef; className?: string }) {
  const ext = r.origin === "external";
  if (ext) {
    return (
      <a className={className} href={r.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {r.pin}
      </a>
    );
  }
  return (
    <Link className={className} href={r.href} onClick={(e) => e.stopPropagation()}>
      {r.pin}
    </Link>
  );
}

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
  const oecdPin = pick?.refs.find((r) => r.side === "oecd");
  const rdPin = pick?.refs.find((r) => r.side === "rd");

  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>OECD vs Thai RD gap review.</strong> Each finding is pinned to an OECD article, a Thai instrument, and a GMT24 rule or module. If OECD and RD conflict, the Thai instrument is the ground. If they do not, the 2026 Commentary is the ground. The LLM does not invent a Thai difference.
        </div>
        <div className="stack-actions">
          <a className="btn btn-secondary" href={THAI_PACK.rdMappingPdf} target="_blank" rel="noreferrer">RD mapping PDF</a>
          <a className="btn btn-secondary" href={THAI_PACK.oecdCommentary} target="_blank" rel="noreferrer">OECD Commentary</a>
          <Link href="/playbook/oecd-rd-gap" className="btn btn-secondary">Playbook</Link>
          <button className="btn btn-primary" onClick={() => ask("Where does the OECD calculation diverge from Thai RD Pillar Two requirements?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Review</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>{R.headline}</div>
          <div className="kpi-sub">{R.pack} · {R.version} · {R.items.length} topics · {R.sources.length} sources</div>
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
            <thead><tr><th>Area</th><th>OECD pin</th><th>Thai RD pin</th><th>Kind</th><th>Live finding</th></tr></thead>
            <tbody>
              {rows.map((g) => {
                const o = g.refs.find((r) => r.side === "oecd");
                const t = g.refs.find((r) => r.side === "rd");
                return (
                  <tr key={g.id} className="clickable" onClick={() => setSel(g.id)}>
                    <td>{g.area}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{o ? <RefLink r={o} /> : g.oecdCite}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{t ? <RefLink r={t} /> : g.rdCite}</td>
                    <td><span className={`tag ${KIND_TAG[g.kind]}`}>{GAP_KIND_LABEL[g.kind]}</span></td>
                    <td style={{ fontSize: 12 }}>{g.finding}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pick && (
        <>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="panel">
              <div className="panel-head">
                <h4>OECD Core · {pick.area}</h4>
                {oecdPin ? <a className="tag tag-outline" href={oecdPin.href} target={oecdPin.origin === "external" ? "_blank" : undefined} rel="noreferrer">{pick.oecdCite}</a> : <span className="tag tag-outline">{pick.oecdCite}</span>}
              </div>
              <div className="panel-body">
                <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>{pick.oecd}</p>
                <div className="wf-row"><span>GMT24 GloBE Core</span><span style={{ maxWidth: 360, textAlign: "right" }}>{pick.core}</span></div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head">
                <h4>Thai RD · {pick.area}</h4>
                <span className={`tag ${KIND_TAG[pick.kind]}`}>{GAP_KIND_LABEL[pick.kind]}</span>
              </div>
              <div className="panel-body">
                <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>{pick.rd}</p>
                <div className="wf-row"><span>Cite</span><span>{rdPin ? <RefLink r={rdPin} /> : pick.rdCite}</span></div>
                <div className="wf-row"><span>Thai pack</span><span style={{ maxWidth: 360, textAlign: "right" }}>{pick.pack}</span></div>
                <div className="wf-row total"><span>Action</span><span style={{ maxWidth: 360, textAlign: "right" }}>{pick.action}</span></div>
                <div className="stack-actions" style={{ marginTop: 12 }}>
                  <Link href={pick.href} className="btn btn-primary">Open module</Link>
                  <Link href="/playbook/oecd-rd-gap" className="btn btn-secondary">Step {pick.play}</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <h4>Ground of analysis · {pick.id}</h4>
              <span className="tag tag-outline">{pick.refs.length} sources</span>
            </div>
            <p style={{ margin: "16px 20px 0", fontSize: 14, lineHeight: 1.55 }}>{pick.ground}</p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Side</th><th>Instrument</th><th>Pin</th><th></th></tr></thead>
                <tbody>
                  {pick.refs.map((r) => (
                    <tr key={`${r.side}-${r.href}-${r.pin}`}>
                      <td><span className={`tag ${r.side === "rd" ? "tag-warn" : r.side === "oecd" ? "tag-accent" : "tag-ok"}`}>{GAP_REF_SIDE[r.side]}</span></td>
                      <td>{r.label}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{r.pin}</td>
                      <td>
                        {r.origin === "external" ? (
                          <a className="btn btn-ghost" href={r.href} target="_blank" rel="noreferrer">Open source</a>
                        ) : (
                          <Link className="btn btn-ghost" href={r.href}>Open module</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Source register · this review</h4>
          <a className="btn btn-ghost" href={THAI_PACK.rdDecree} target="_blank" rel="noreferrer">rd.go.th/67365</a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Side</th><th>Source</th><th>Used on</th><th></th></tr></thead>
            <tbody>
              {R.sources.map((s) => {
                const used = R.items.filter((i) => i.refs.some((r) => r.href === s.href && r.label === s.label)).map((i) => i.area);
                return (
                  <tr key={`${s.side}-${s.href}-${s.label}`}>
                    <td><span className={`tag ${s.side === "rd" ? "tag-warn" : s.side === "oecd" ? "tag-accent" : "tag-ok"}`}>{GAP_REF_SIDE[s.side]}</span></td>
                    <td>
                      <div>{s.label}</div>
                      <div className="mono text-muted" style={{ fontSize: 11 }}>{s.href}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{used.join(" · ")}</td>
                    <td>
                      {s.origin === "external" ? (
                        <a className="btn btn-ghost" href={s.href} target="_blank" rel="noreferrer">Open</a>
                      ) : (
                        <Link className="btn btn-ghost" href={s.href}>Open</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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
