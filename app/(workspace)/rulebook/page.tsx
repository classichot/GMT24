"use client";

import Link from "next/link";
import { RULES } from "@/lib/model";
import { passagesForRule } from "@/lib/legal";

function SourcesCell({ ruleId }: { ruleId: string }) {
  const ps = passagesForRule(ruleId);
  if (!ps.length) return <span className="text-muted">—</span>;
  const oecd = ps.filter((p) => p.sourceId.startsWith("OECD")).length;
  const domestic = ps.length - oecd;
  return (
    <Link href={`/legal?rule=${encodeURIComponent(ruleId)}`} className="mono" style={{ whiteSpace: "nowrap" }} title={ps.map((p) => p.ref).join(" · ")}>
      {ps.length} passage{ps.length === 1 ? "" : "s"}
      <span className="text-muted" style={{ fontSize: 11, marginLeft: 6 }}>{oecd ? `OECD ${oecd}` : ""}{oecd && domestic ? " · " : ""}{domestic ? `domestic ${domestic}` : ""}</span>
    </Link>
  );
}

export default function RulebookPage() {
  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        GMT24 Global Rulebook — effective-dated OECD + jurisdictional packs. The calculation DAG selects rules by jurisdiction, fiscal year and entity. An LLM does not write the formula. Thailand is a separate pack (TH-PACK-2567) — not a translation of this list.{" "}
        <Link href="/thailand">Open Thailand pack</Link> · Every rule links to the passages that back it in the{" "}
        <Link href="/legal">legal corpus</Link>.
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Rule</th><th>Jur.</th><th>Type</th><th>From</th><th>To</th><th>Version</th><th>Status</th><th>Sources</th></tr></thead>
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
                  <td><SourcesCell ruleId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
