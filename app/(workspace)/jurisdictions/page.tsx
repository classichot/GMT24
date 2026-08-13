"use client";

import { JURISDICTION_PACKS } from "@/lib/model";

export default function JurisdictionsPage() {
  return (
    <div className="panel">
      <div className="panel-head"><h4>Central Record packs</h4><span className="text-muted">Demo dated Aug 2026 · not a live OECD scrape</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Jurisdiction</th><th>IIR</th><th>QDMTT</th><th>QDMTT SH</th><th>UTPR</th><th>Effective</th><th>Qualified</th><th>Filing</th><th>FX</th><th>Notes</th></tr></thead>
          <tbody>
            {JURISDICTION_PACKS.map((p) => (
              <tr key={p.iso}>
                <td>{p.name}</td>
                <td>{p.iir ? "Y" : "—"}</td>
                <td>{p.qdmtt ? "Y" : "—"}</td>
                <td>{p.qdmttSH ? "Y" : "—"}</td>
                <td>{p.utpr ? "Y" : "—"}</td>
                <td>{p.from}</td>
                <td>{p.qualified}</td>
                <td>{p.filing}</td>
                <td>{p.fx}</td>
                <td style={{ fontSize: 12 }}>{p.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
