"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Presentation } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { AUDIENCE_LABEL, type Audience } from "@/lib/ai/briefing";
import type { Section } from "@/lib/ai/types";

const AUDIENCES: Audience[] = ["cfo", "tax-committee", "board"];
const AUDIENCE_NOTE: Record<Audience, string> = {
  cfo: "Five jurisdictions, movement with drivers, decisions with amounts.",
  "tax-committee": "Full jurisdiction table, every open decision, all uncertainty flags.",
  board: "Three jurisdictions. Is the number final, who collects, what could move it.",
};

function slides(sections: Section[], title: string, sub: string) {
  const out: string[] = [`# ${title}`, "", sub, ""];
  for (const s of sections) {
    out.push("---", "", `## ${s.title ?? (s.kind === "conclusion" ? "Headline" : s.kind)}`, "");
    if (s.text) out.push(s.text, "");
    if (s.rows && s.head) { out.push(`| ${s.head.join(" | ")} |`, `| ${s.head.map(() => "---").join(" | ")} |`); for (const r of s.rows) out.push(`| ${r.join(" | ")} |`); out.push(""); }
    for (const it of s.items ?? []) out.push(`- ${it}`);
    out.push("");
  }
  return out.join("\n");
}

export default function BriefingPage() {
  return <Suspense><BriefingInner /></Suspense>;
}

function BriefingInner() {
  const ai = useAi();
  const { setCopilotOpen } = useStore();
  const params = useSearchParams();
  const initial = params.get("audience");
  const [audience, setAudience] = useState<Audience>(AUDIENCES.includes(initial as Audience) ? (initial as Audience) : "cfo");
  useEffect(() => { if (AUDIENCES.includes(initial as Audience)) setAudience(initial as Audience); }, [initial]);

  const b = useMemo(() => ai.briefingFor(audience), [ai, audience]);
  const stamp = `${ai.ctx.groupName} · ${ai.ctx.fy} · ${ai.ctx.calcVersion}`;
  const file = (ext: "md" | "slides.md") => `briefing-${audience}-${ai.ctx.fy}.${ext}`;
  const download = (kind: "memo" | "slides") => ai.run(propose("download", { name: file(kind === "memo" ? "md" : "slides.md"), body: kind === "memo" ? b.markdown : slides(b.sections, `Pillar Two briefing — ${AUDIENCE_LABEL[audience]}`, stamp) }, ai.ctx, { label: `Download ${AUDIENCE_LABEL[audience]} ${kind} (draft)` }));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <h5>CFO Briefing</h5>
            <div className="text-muted" style={{ fontSize: 11 }}>{stamp} · {b.provisional ? <span className="tag tag-warn" style={{ fontSize: 10 }}>PROVISIONAL</span> : <span className="tag tag-ok" style={{ fontSize: 10 }}>approved snapshot</span>}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {AUDIENCES.map((a) => <button key={a} className={`chip${audience === a ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setAudience(a)}>{AUDIENCE_LABEL[a]}</button>)}
            <span style={{ width: 8 }} />
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => download("memo")}><FileText size={13} /> Memo</button>
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => download("slides")}><Presentation size={13} /> Slides</button>
          </div>
        </div>
        <div className="text-muted" style={{ fontSize: 12, padding: "0 16px 12px" }}>{AUDIENCE_NOTE[audience]} Every figure is copied from the calculation version above. {b.provisional ? "Figures depend on open X-Ray items or estimated data — not for external use." : "Snapshot approved."}</div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)" }}>
        <div className="panel">
          <div className="panel-head"><h5>Draft · {AUDIENCE_LABEL[audience]}</h5><span className="text-muted" style={{ fontSize: 11 }}>prepared by GMT24 Co-Pilot for {ai.ctx.user.name}</span></div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 14 }}>
            {b.sections.map((s, i) => (
              <section key={i}>
                <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.title ?? (s.kind === "conclusion" ? "Headline" : s.kind)}</div>
                {s.text && <p style={{ margin: 0, fontSize: s.kind === "conclusion" ? 15 : 13, fontWeight: s.kind === "conclusion" ? 600 : 400 }}>{s.text}</p>}
                {s.rows && s.head && (
                  <div className="table-wrap" style={{ marginTop: 6 }}>
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead><tr>{s.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>{s.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                {s.items && <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>{s.items.map((it, j) => <li key={j}>{it}</li>)}</ul>}
              </section>
            ))}
            <div className="text-muted" style={{ fontSize: 11, borderTop: "1px solid var(--color-divider)", paddingTop: 8 }}>Items marked provisional or X-Ray open may change. This document is a draft for internal review; downloading records a draft in the AI audit log.</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="panel">
            <div className="panel-head"><h5>Ask about this briefing</h5></div>
            <div style={{ padding: "0 16px 16px", display: "grid", gap: 6 }}>
              {["What could move the number?", "Why did the top-up change versus last year?", "Which decisions are outstanding?", `Make the ${AUDIENCE_LABEL[audience === "board" ? "cfo" : "board"]} version`].map((q) => (
                <button key={q} className="chip" style={{ fontSize: 12, textAlign: "left", justifyContent: "flex-start" }} onClick={() => { setCopilotOpen(true); void ai.ask(q, { feature: q.startsWith("Make") ? "briefing" : undefined }); }}>{q}</button>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h5>Where the figures come from</h5></div>
            <div style={{ padding: "0 16px 16px", fontSize: 12, display: "grid", gap: 6 }}>
              <div>Exposure and collection: <Link href="/overview">Group overview</Link> · <Link href="/top-up">Top-up</Link></div>
              <div>Movement: <Link href="/years">Year ledger</Link> · Core baseline comparison</div>
              <div>Uncertainty: <Link href="/xray">Pillar Two X-Ray</Link> · <Link href="/reviewer">Calculation Reviewer</Link></div>
              <div>Decisions: <Link href="/elections">Elections</Link> · <Link href="/strategy">Strategy Simulator</Link></div>
              <div>Open work: <Link href="/tasks">Tasks</Link> ({ai.tasks.filter((t) => t.status === "open" || t.status === "assigned").length} open)</div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h5>Recent briefing drafts</h5></div>
            <div style={{ padding: "0 16px 16px", fontSize: 12, display: "grid", gap: 4 }}>
              {ai.state.audit.filter((a) => a.actionId === "download" && /briefing/.test(a.summary)).slice(0, 6).map((a) => <div key={a.id} className="text-muted"><Download size={11} style={{ verticalAlign: -1 }} /> {a.at.slice(0, 16).replace("T", " ")} · {a.actor} · {a.calcVersion}</div>)}
              {!ai.state.audit.some((a) => a.actionId === "download" && /briefing/.test(a.summary)) && <div className="text-muted">No drafts downloaded yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
