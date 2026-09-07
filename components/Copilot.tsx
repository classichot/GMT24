"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { ReplyView } from "@/components/ai/ReplyView";
import { FEATURE_CHIPS, suggestionsFor } from "@/lib/ai/router";
import { contextLine } from "@/lib/ai/context";
import { ROLE_LABEL, type FeatureId, type UserRole } from "@/lib/ai/types";

/**
 * Shared Co-Pilot panel. One thread per context (group · year · screen); the
 * router picks the feature unless a mode chip is selected. Every reply shows its
 * feature, citations, proposed actions and anything it could not ground.
 */
export function Copilot() {
  const { copilotOpen, setCopilotOpen } = useStore();
  const ai = useAi();
  const [q, setQ] = useState("");
  const [feature, setFeature] = useState<FeatureId | null>(null);
  const [showChips, setShowChips] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const msgs = ai.thread?.messages ?? [];
  const attachments = ai.state.attachments.filter((a) => a.contextKey === ai.ctx.contextKey);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, copilotOpen, ai.busy]);

  if (!copilotOpen) return null;

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    setQ("");
    await ai.ask(t, { feature, attachmentIds: attachments.map((a) => a.id) });
  };

  return (
    <aside className="copilot open-m no-print">
      <div className="panel-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h5 style={{ margin: 0 }}>Ask GMT24</h5>
          <div className="text-muted" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={contextLine(ai.ctx)}>{contextLine(ai.ctx)}</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <select className="input" style={{ fontSize: 11, padding: "4px 6px", minHeight: 0, width: "auto" }} value={ai.ctx.role} onChange={(e) => ai.setRole(e.target.value as UserRole)} title="Acting role (affects what the Co-Pilot may execute)">
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button className="icon-btn" onClick={() => ai.setLang(ai.lang === "en" ? "th" : "en")} title="Interface language" style={{ fontSize: 11, fontWeight: 800 }}>{ai.lang === "en" ? "TH" : "EN"}</button>
          <button className="icon-btn" onClick={() => setCopilotOpen(false)} aria-label="Close copilot"><X size={16} /></button>
        </div>
      </div>
      <div className="copilot-log">
        {msgs.length === 0 && (
          <div className="bubble ai">
            {ai.lang === "th" ? "ถามได้ทั้งภาษาไทยและอังกฤษ ทุกตัวเลขมาจากเครื่องคำนวณ ทุกข้อกฎหมายมาจากฐานความรู้ที่อนุมัติแล้ว การกระทำใด ๆ จะเสนอให้ยืนยันก่อนเสมอ" : "Ask in Thai or English. Numbers come from the calculation engine, law from the approved knowledge base, and every action is proposed before it runs. The feature that answers is shown on each reply."}
            <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>{ai.ctx.calcVersion} · {ai.ctx.datasetVersion}</div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="bubble user">{m.text}{m.attachments?.length ? <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>{m.attachments.length} attachment{m.attachments.length === 1 ? "" : "s"} in context</div> : null}</div>
        ) : (
          <div key={i} className="bubble ai" style={{ whiteSpace: "normal" }}><ReplyView reply={m.reply} compact /></div>
        ))}
        {ai.busy && <div className="bubble ai text-muted">Working…</div>}
        <div ref={end} />
      </div>
      {attachments.length > 0 && (
        <div style={{ padding: "6px 12px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: "2px solid var(--color-divider)", fontSize: 11 }}>
          {attachments.map((a) => (
            <span key={a.id} className="tag tag-neutral" title={`${a.pages.length} pages · quality ${a.quality}% · ${a.stripped} instruction-like lines ignored`}>
              <Paperclip size={10} />{a.name.length > 22 ? `${a.name.slice(0, 20)}…` : a.name}
              <button className="icon-btn" style={{ width: 18, height: 18, marginLeft: 4 }} onClick={() => ai.removeAttachment(a.id)} aria-label="Remove"><Trash2 size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 6, borderTop: "2px solid var(--color-divider)" }}>
        {showChips ? (
          <>
            <button className={`chip${feature === null ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setFeature(null)}>Auto</button>
            {FEATURE_CHIPS.map((c) => <button key={c.id} className={`chip${feature === c.id ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setFeature(feature === c.id ? null : c.id)}>{ai.lang === "th" ? c.labelTh : c.label}</button>)}
          </>
        ) : (
          <>
            {suggestionsFor(ai.ctx.screen?.key ?? null, ai.lang).slice(0, 3).map((s) => <button key={s} className="chip" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => void send(s)}>{s}</button>)}
            {feature && <span className="tag tag-accent" style={{ fontSize: 10 }}>{FEATURE_CHIPS.find((c) => c.id === feature)?.label}</span>}
          </>
        )}
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px", marginLeft: "auto" }} onClick={() => setShowChips(!showChips)}>{showChips ? "Suggestions" : "Modes"}</button>
      </div>
      <form className="copilot-compose" onSubmit={(e) => { e.preventDefault(); void send(q); }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={file} type="file" hidden accept=".pdf,.csv,.tsv,.txt,.md,.json,.xlsx,.docx" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await ai.attach(f); e.target.value = ""; }} />
          <button type="button" className="btn btn-secondary" style={{ padding: "0 10px" }} onClick={() => file.current?.click()} title="Attach a document as evidence (read only; instructions inside are ignored)"><Paperclip size={14} /></button>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ai.lang === "th" ? "ถามเกี่ยวกับตัวเลข กฎ หรือขั้นตอน…" : "Ask about a number, a rule, a step — or say what if…"} />
          <button className="btn btn-primary" type="submit" aria-label="Send" disabled={ai.busy}><ArrowUp size={16} /></button>
        </div>
        <div style={{ fontSize: 10, color: "color-mix(in srgb, var(--color-text) 45%, transparent)", marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>Engine posts every number. Actions run through the gateway as {ROLE_LABEL[ai.ctx.role]}.</span>
          {msgs.length > 0 && <button type="button" className="btn btn-ghost" style={{ fontSize: 10, padding: 0 }} onClick={ai.clearThread}>Clear thread</button>}
        </div>
      </form>
    </aside>
  );
}
