"use client";

import { FILINGS } from "@/lib/model";
import { useStore } from "@/lib/store";

export default function NotificationsPage() {
  const { flash } = useStore();
  return (
    <div>
      <p className="text-muted">Local GIR filing can be relieved where central filing, notifications and exchange conditions are satisfied.</p>
      {FILINGS.filter((f) => f.requirement.toLowerCase().includes("notif") || f.requirement.toLowerCase().includes("memo")).map((f) => (
        <div key={f.id} className="panel" style={{ marginTop: 12 }}>
          <div className="panel-head">
            <div><h4 style={{ margin: 0 }}>{f.jurisdiction}</h4><div className="text-muted" style={{ fontSize: 12 }}>{f.requirement} · {f.deadline}</div></div>
            <button className="btn btn-primary" onClick={() => flash("Notification pack generated")}>Generate</button>
          </div>
        </div>
      ))}
    </div>
  );
}
