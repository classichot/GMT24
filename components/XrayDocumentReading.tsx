"use client";

import { useRef, useState } from "react";
import { FileSearch, Upload } from "lucide-react";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import { groupEntityRefs, proposedFacts, readDocumentForFinding, type DocReading } from "@/lib/ai/factsClient";
import type { Attachment } from "@/lib/ai/types";
import type { XrayFinding } from "@/lib/xray";

/**
 * X-Ray Interviewer — document reading panel. The user attaches the evidence
 * the finding asks for; the model reads it against this finding and proposes
 * facts with page and quote. Each proposal can be recorded as the answer (when
 * it maps to an allowed option), confirmed by an accountable person, or linked
 * as the validated evidence. Nothing is confirmed automatically.
 */
export function XrayDocumentReading({ finding: f, missing, onAttachEvidence }: { finding: XrayFinding; missing: string[]; onAttachEvidence: (kind: string) => void }) {
  const ai = useAi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");
  const [reading, setReading] = useState<{ attachment: Attachment; result: DocReading } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const docs = ai.state.attachments.filter((a) => a.contextKey === ai.ctx.contextKey || a.contextKey === "*");
  const existing = ai.facts.filter((x) => x.source === "document" && x.findingId === f.id);

  const read = async (a: Attachment) => {
    setError(null);
    setBusy(a.id);
    setStage(`Reading ${a.name} (${a.pages.length} pages) against “${f.title}” with ${ai.model.model || "the configured model"}…`);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await readDocumentForFinding(a, f, ai.ctx.fy, groupEntityRefs(ai.calcs), ctrl.signal);
      setReading({ attachment: a, result: r });
      const facts = proposedFacts(r, a, f, ai.ctx);
      for (const fact of facts) ai.addFact(fact);
    } catch (e) {
      if (ctrl.signal.aborted) setError("Reading cancelled. The document stays attached.");
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setStage("");
      abortRef.current = null;
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("attach");
    setStage(`Extracting text from ${file.name}…`);
    const a = await ai.attach(file);
    setBusy(null);
    setStage("");
    if (a) await read(a);
    else setError("The file could not be read. PDF, CSV and text files with a text layer are supported.");
  };

  const recordAnswer = (questionId: string, optionValue: string, page: number, name: string) => {
    const q = f.questions.find((x) => x.id === questionId);
    const o = q?.options.find((x) => x.value === optionValue);
    if (!q || !o) return;
    ai.run(propose("answer-xray", { findingId: f.id, questionId: q.id, value: o.value, label: `${o.label} (from ${name} p.${page})` }, ai.ctx));
  };

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <h4><FileSearch size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Read the supporting document</h4>
        <span className="text-muted">{ai.model.configured ? `Model: ${ai.model.model}` : "No model configured"}</span>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: 12 }}>
        <div className="text-muted" style={{ fontSize: 12 }}>
          Attach the evidence this item asks for ({f.proofRequired}). The Interviewer reads it against the question, proposes facts with the page and the exact quote, and flags anything it contradicts or leaves open. Proposals stay <em>proposed</em> until {f.owner} confirms them.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,.md,.json" style={{ display: "none" }} onChange={(e) => void onFile(e.target.files?.[0])} />
          <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!!busy || !ai.model.configured} onClick={() => fileRef.current?.click()}><Upload size={13} />Attach and read a document</button>
          {docs.map((a) => (
            <button key={a.id} className="btn btn-secondary" style={{ fontSize: 12 }} disabled={!!busy || !ai.model.configured} onClick={() => void read(a)} title={`${a.pages.length} pages · extraction quality ${a.quality}%`}>Read {a.name.length > 32 ? `${a.name.slice(0, 30)}…` : a.name}</button>
          ))}
          {busy && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => abortRef.current?.abort()}>Cancel</button>}
        </div>
        {!ai.model.configured && <div className="reply-warn" style={{ fontSize: 12 }}>Document reading needs a language model. Configure <code>GMT24_LLM_PROVIDER</code> and <code>GMT24_LLM_MODEL</code> on the server; attachments can still be added and read page by page in the Co-Pilot.</div>}
        {stage && <div className="text-muted" style={{ fontSize: 12 }} role="status" aria-live="polite">{stage} This can take a minute; you can keep working.</div>}
        {error && <div className="reply-warn" style={{ fontSize: 12 }} role="alert">{error} {reading ? "" : "Retry with the same file, or answer the question directly and attach the document as evidence."}</div>}

        {reading && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12 }}>
              <strong>{reading.attachment.name}</strong> — {reading.result.relevant ? "relevant to this item" : "the model found nothing about this item"}; {reading.result.facts.length} proposed fact{reading.result.facts.length === 1 ? "" : "s"}, {reading.result.verification.verified}/{reading.result.verification.checked} quotes verified against the page; pages read {reading.result.pagesRead.join(", ") || "—"}; model {reading.result.model}.
            </div>
            {reading.result.facts.length > 0 && (
              <div className="table-wrap">
                <table className="table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Proposed fact</th><th>Evidence</th><th>Answers</th><th></th></tr></thead>
                  <tbody>
                    {reading.result.facts.map((d, i) => {
                      const q = f.questions.find((x) => x.id === d.questionId);
                      const o = q?.options.find((x) => x.value === d.optionValue);
                      return (
                        <tr key={i}>
                          <td><div>{d.statement}</div><div className="text-muted" style={{ fontSize: 11 }}>{d.value ? `Value: ${d.value} · ` : ""}{d.period ? `Period: ${d.period} · ` : ""}confidence {d.confidence}</div></td>
                          <td style={{ maxWidth: 320 }}><div className="passage" style={{ fontSize: 11 }}>p.{d.page}: “{d.quote}”</div><span className={`tag ${d.verified ? "tag-ok" : "tag-warn"}`} style={{ fontSize: 10 }}>{d.verified ? "quote verified" : "quote not found on page — check the original"}</span></td>
                          <td style={{ fontSize: 11 }}>{q ? <>{q.prompt.slice(0, 70)}{o ? <><br /><strong>{o.label}</strong></> : <><br /><span className="text-muted">no allowed value fits exactly</span></>}</> : <span className="text-muted">general fact</span>}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{q && o && d.verified ? <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => recordAnswer(q.id, o.value, d.page, reading.attachment.name)}>Record answer</button> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {reading.result.contradictions.length > 0 && <div className="reply-warn" style={{ fontSize: 12 }}><strong>Contradictions.</strong> {reading.result.contradictions.join(" ")}</div>}
            {reading.result.followUps.length > 0 && <div style={{ fontSize: 12 }}><strong>Still open after this document.</strong><ul style={{ margin: "4px 0 0 16px" }}>{reading.result.followUps.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            {reading.result.notes.length > 0 && <div className="text-muted" style={{ fontSize: 11 }}>{reading.result.notes.join(" · ")}</div>}
            {reading.result.relevant && missing.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12 }}>
                <span>Link this document as:</span>
                {missing.map((m) => <button key={m} className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => onAttachEvidence(m)}>{m}</button>)}
              </div>
            )}
          </div>
        )}

        {existing.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase" }}>On the fact registry for this item</div>
            {existing.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, alignItems: "center", borderBottom: "1px solid var(--color-divider)", paddingBottom: 6 }}>
                <div><div>{x.statement}{x.value ? <> → <strong>{x.value}</strong></> : null}</div><div className="text-muted" style={{ fontSize: 11 }}>{x.evidence[0]} · {x.status}{x.confirmedBy ? ` by ${x.confirmedBy}` : ""}</div></div>
                {x.status === "proposed" ? <button className="btn btn-secondary" style={{ fontSize: 11, flex: "none" }} onClick={() => ai.run(propose("confirm-fact", { id: x.id }, ai.ctx))}>Confirm as {ai.ctx.user.name}</button> : <span className="tag tag-ok" style={{ fontSize: 10, flex: "none" }}>{x.status}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
