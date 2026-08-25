"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, X } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { answerCopilot, SUGGESTIONS, type CopilotMsg } from "@/lib/copilot";
import { useCalc } from "@/lib/useCalc";

export function Copilot() {
  const { copilotOpen, setCopilotOpen, consumeAsk, pendingAsk } = useStore();
  const { calcs } = useCalc();
  const [log, setLog] = useState<CopilotMsg[]>([
    {
      role: "assistant",
      text: "Ask GMT24. I answer from the calculation snapshot and the approved OECD / local rulebook — not from general model memory.\n\nEvery material answer cites calculation + data source + rule + version.",
      cites: [{ label: "GMT24-CALC 2026.2" }],
    },
  ]);
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingAsk) return;
    const pending = consumeAsk();
    if (pending) run(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, copilotOpen]);

  function run(text: string) {
    const t = text.trim();
    if (!t) return;
    setLog((l) => [...l, { role: "user", text: t }, answerCopilot(t, calcs)]);
    setQ("");
  }

  if (!copilotOpen) return null;

  return (
    <aside className="copilot open-m no-print">
      <div className="panel-head">
        <div>
          <h5 style={{ margin: 0 }}>Ask GMT24</h5>
          <div className="text-muted" style={{ fontSize: 11 }}>Grounded copilot</div>
        </div>
        <button className="icon-btn" onClick={() => setCopilotOpen(false)} aria-label="Close copilot"><X size={16} /></button>
      </div>
      <div className="copilot-log">
        {log.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "user" : "ai"}`}>
            {m.text}
            {m.cites && m.cites.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {m.cites.map((c) =>
                  c.href ? (
                    c.href.startsWith("http") ? (
                      <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="tag tag-outline" style={{ fontSize: 10 }}>
                        <BookOpen size={10} style={{ marginRight: 4 }} />{c.label}
                      </a>
                    ) : (
                      <Link key={c.label} href={c.href} className="tag tag-outline" style={{ fontSize: 10 }}>
                        <BookOpen size={10} style={{ marginRight: 4 }} />{c.label}
                      </Link>
                    )
                  ) : (
                    <span key={c.label} className="tag tag-outline" style={{ fontSize: 10 }}><BookOpen size={10} style={{ marginRight: 4 }} />{c.label}</span>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div style={{ padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: "2px solid var(--color-divider)" }}>
        {SUGGESTIONS.slice(0, 3).map((s) => (
          <button key={s} className="chip" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => run(s)}>{s}</button>
        ))}
      </div>
      <form
        className="copilot-compose"
        onSubmit={(e) => { e.preventDefault(); run(q); }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about any number on screen…" />
          <button className="btn btn-primary" type="submit" aria-label="Send"><ArrowUp size={16} /></button>
        </div>
        <div style={{ fontSize: 10, color: "color-mix(in srgb, var(--color-text) 45%, transparent)", marginTop: 8 }}>
          Answers cite calculation, data source, rule and rule version. The engine, not the model, computes every number.
        </div>
      </form>
    </aside>
  );
}
