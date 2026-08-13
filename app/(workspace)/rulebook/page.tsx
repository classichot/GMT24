"use client";

import { RULES } from "@/lib/model";

export default function RulebookPage() {
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        GMT24 Global Rulebook — effective-dated OECD + jurisdictional packs. The calculation DAG selects rules by jurisdiction, fiscal year and entity. An LLM does not write the formula.
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Rule</th><th>Jur.</th><th>Type</th><th>From</th><th>To</th><th>Version</th><th>Status</th></tr></thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="mono" style={{ fontWeight: 600 }}>{r.id}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{r.source}</div>
                    <div className="text-muted mono" style={{ fontSize: 12 }}>{r.formula}</div>
                  </td>
                  <td>{r.jurisdiction}</td>
                  <td>{r.ruleType}</td>
                  <td>{r.effectiveFrom}</td>
                  <td>{r.effectiveTo ?? "open"}</td>
                  <td>{r.version}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
