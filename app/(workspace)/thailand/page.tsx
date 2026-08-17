"use client";

import Link from "next/link";
import { THAI_INSTRUMENTS, THAI_MODULES, THAI_PACK } from "@/lib/thailand";
import { ThaiPackBar } from "@/components/ThaiPackBar";
import { useStore } from "@/lib/store";

export default function ThailandPackPage() {
  const { ask } = useStore();
  return (
    <div>
      <ThaiPackBar />
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Thailand Jurisdiction Pack {THAI_PACK.version}.</strong> This is not a Thai translation of the OECD engine. GMT24 Global GloBE Core still posts FANIL, GloBE income, Covered Taxes and ETR. This pack adds Thai entity situs, Thai SBIE, BOT FX, Thai liability ordering, filing clocks and audit defence. Inherits {THAI_PACK.inherits}. {THAI_PACK.override}.
        </div>
        <div className="stack-actions">
          <Link href="/thailand/boi" className="btn btn-secondary">BOI Optimizer</Link>
          <Link href="/thailand/gap" className="btn btn-secondary">OECD vs RD gap</Link>
          <a className="btn btn-secondary" href={THAI_PACK.rdPage} target="_blank" rel="noreferrer">RD notifications</a>
          <a className="btn btn-secondary" href={THAI_PACK.oecdCommentary} target="_blank" rel="noreferrer">OECD Commentary 2026</a>
          <button className="btn btn-primary" onClick={() => ask("How does the Thailand Jurisdiction Pack differ from the OECD engine?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <div className="kpi-label">Pack</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>{THAI_PACK.id}</div>
          <div className="kpi-sub">{THAI_PACK.engine}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Calculation rules</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>Available</div>
          <div className="kpi-sub">Decree + DG 1–8 + MOF 1</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Filing schema</div>
          <div className="kpi-val" style={{ fontSize: 22 }}>Pending</div>
          <div className="kpi-sub">ss 31, 33, 53–57</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Do not market</div>
          <div className="kpi-val" style={{ fontSize: 18 }}>Not filing-ready</div>
          <div className="kpi-sub">{THAI_PACK.fy}</div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head"><h4>Product architecture</h4><span className="mono">{THAI_PACK.version}</span></div>
        <div className="panel-body">
          <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
{`GMT24 Global GloBE Core
        ↓
Thailand Jurisdiction Pack  ${THAI_PACK.id}  v${THAI_PACK.version}
        ↓
Thai QDMTT + IIR + UTPR Orchestrator
        ↓
BOI–Pillar Two Incentive Optimizer
        ↓
Thai Filing Command Centre
        ↓
Thai Audit Defence Book`}
          </pre>
          <p className="text-muted" style={{ margin: "12px 0 0", fontSize: 13 }}>{THAI_PACK.coverage.note}</p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {THAI_MODULES.filter((m) => m.href !== "/thailand").map((m) => (
          <Link key={m.href} href={m.href} className="panel" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="panel-body">
              <h4 style={{ margin: "0 0 6px" }}>{m.title}</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{m.body}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>Instruments in this pack</h4>
          <a href={THAI_PACK.rdPage} target="_blank" rel="noreferrer" className="btn btn-ghost">rd.go.th/68005</a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Instrument</th><th>Content</th><th>GMT24 module</th><th>Status</th></tr></thead>
            <tbody>
              {THAI_INSTRUMENTS.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.cite}</td>
                  <td>{r.loc}</td>
                  <td><Link href={r.href}>{r.module}</Link></td>
                  <td><span className={`tag ${r.status === "in-pack" ? "tag-ok" : "tag-warn"}`}>{r.status === "in-pack" ? "In pack" : "Pending"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
