"use client";

export default function ArchivePage() {
  const rows = [
    { fy: "FY2025", what: "Central GIR XML", status: "Filed", when: "18 Jun 2026" },
    { fy: "FY2025", what: "Thai QDMTT pack", status: "Filed", when: "02 Jun 2026" },
    { fy: "FY2025", what: "Singapore MTT notification", status: "Filed", when: "12 Dec 2025" },
    { fy: "FY2024", what: "Transitional CbCR SH memo", status: "Locked", when: "30 Jun 2025" },
  ];
  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>FY</th><th>Pack</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.what}><td>{r.fy}</td><td>{r.what}</td><td><span className="status-done">{r.status}</span></td><td>{r.when}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
