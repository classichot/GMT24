"use client";

import { useStore } from "@/lib/store";
import { SUGGESTIONS } from "@/lib/copilot";

export default function CopilotPage() {
  const { setCopilotOpen, ask } = useStore();
  return (
    <div>
      <p className="text-muted">The copilot is a persistent panel. It answers from GMT24 calculations + the approved rulebook.</p>
      <div className="stack-actions" style={{ marginTop: 16 }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => { setCopilotOpen(true); ask(s); }}>{s}</button>
        ))}
      </div>
    </div>
  );
}
