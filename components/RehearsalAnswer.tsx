"use client";

import { useRef, useState } from "react";
import { MessageSquareText, RotateCcw, Square } from "lucide-react";
import { useAi } from "@/components/AiProvider";
import { propose } from "@/lib/ai/actions";
import type { RehearsalQ } from "@/lib/ai/rehearsal";
import { evaluateAnswer, VERDICT_LABEL, type RehearsalAttempt, type Verdict } from "@/lib/ai/rehearsalClient";

/**
 * Audit Rehearsal — the interactive part. The team member answers the auditor
 * question in their own words; the model judges the answer against the record,
 * lists contradictions and unsupported claims, asks the follow-up an auditor
 * would ask, and drafts a grounded response. Follow-ups chain: the next answer
 * is judged against the follow-up with the exchange so far as context. Every
 * attempt is kept on the question and exported with the package.
 */
const TONE: Record<Verdict, string> = { supported: "tag-ok", "partly-supported": "tag-warn", "contradicts-record": "tag-hot", unsupported: "tag-hot" };

export function RehearsalAnswer({ q }: { q: RehearsalQ }) {
  const ai = useAi();
  const attempts = ai.state.rehearsalAttempts[q.id] ?? [];
  const last = attempts[attempts.length - 1];
  const asked = last?.evaluation.followUp || q.question;
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modelOff = !ai.model.configured;

  const submit = async () => {
    const text = answer.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const evaluation = await evaluateAnswer(q, asked, text, attempts, ai.ctx, ctrl.signal);
      const attempt: RehearsalAttempt = { id: `ra-${Date.now().toString(36)}`, asked, answer: text, by: ai.ctx.user.name, at: new Date().toISOString(), evaluation };
      ai.recordRehearsal(q.id, attempt);
      setAnswer("");
    } catch (e) {
      if (ctrl.signal.aborted) setError("Evaluation cancelled. Your answer is still in the box.");
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const remediate = (detail: string) => ai.run(propose("create-task", { title: `Rehearsal gap · ${q.area}${q.iso ? ` · ${q.iso}` : ""}`, detail, owner: "Preparer", severity: "warn", href: "/rehearsal", source: "rehearsal" }, ai.ctx));

  return (
    <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--color-divider)", paddingTop: 10 }}>
      <div className="reply-label" style={{ display: "flex", alignItems: "center", gap: 6 }}><MessageSquareText size={13} />Rehearse — answer in your own words</div>

      {attempts.map((a, i) => (
        <div key={a.id} style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 10, background: "var(--color-surface-2, var(--color-surface))", border: "1px solid var(--color-divider)" }}>
          <div className="text-muted" style={{ fontSize: 11 }}>Round {i + 1} · Auditor: <em>{a.asked}</em></div>
          <div style={{ fontSize: 13 }}><strong>{a.by}:</strong> {a.answer}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`tag ${TONE[a.evaluation.verdict]}`} style={{ fontSize: 10 }}>{VERDICT_LABEL[a.evaluation.verdict]}</span>
            <span style={{ fontSize: 12 }}>{a.evaluation.summary}</span>
          </div>
          {a.evaluation.agreements.length > 0 && <div style={{ fontSize: 12 }}><span className="reply-label">The record supports</span><ul style={{ margin: 0, paddingLeft: 16 }}>{a.evaluation.agreements.map((x, k) => <li key={k}>{x}</li>)}</ul></div>}
          {a.evaluation.contradictions.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <span className="reply-label">Contradicts the record</span>
              <ul style={{ margin: 0, paddingLeft: 16 }}>{a.evaluation.contradictions.map((c, k) => <li key={k}><strong>You said:</strong> {c.claim}{c.record ? <> — <strong>record:</strong> {c.record}</> : null}</li>)}</ul>
            </div>
          )}
          {a.evaluation.unsupported.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <span className="reply-label">Unsupported — evidence gaps</span>
              <ul style={{ margin: 0, paddingLeft: 16 }}>{a.evaluation.unsupported.map((u, k) => <li key={k} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><span>{u}</span><button className="btn btn-ghost" style={{ fontSize: 11, padding: "0 4px" }} onClick={() => remediate(u)}>Create remediation task</button></li>)}</ul>
            </div>
          )}
          {a.evaluation.supportNeeded.length > 0 && <div style={{ fontSize: 12 }}><span className="reply-label">The auditor would now ask to see</span><ul style={{ margin: 0, paddingLeft: 16 }}>{a.evaluation.supportNeeded.map((s, k) => <li key={k}>{s}</li>)}</ul></div>}
          {a.evaluation.draft ? (
            <details style={{ fontSize: 12 }}>
              <summary style={{ cursor: "pointer" }}>Drafted response from the record</summary>
              <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>{a.evaluation.draft}</p>
              <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => ai.run(propose("download", { name: `GMT24-rehearsal-response-${q.id}-${i + 1}.md`, body: `# ${q.area}${q.iso ? ` · ${q.iso}` : ""} — drafted response\n\n**Auditor question.** ${a.asked}\n\n${a.evaluation.draft}\n\nEvidence to produce: ${q.evidence.join("; ") || "none on file"}\n\n_Drafted from ${ai.ctx.calcVersion} by ${a.evaluation.model}; internal rehearsal — not a prediction of the authority's view._` }, ai.ctx))}>Download draft</button>
            </details>
          ) : (
            !a.evaluation.draftGrounded && <div className="text-muted" style={{ fontSize: 11 }}>The model&apos;s draft used figures that are not in the record, so it was withheld. Use the trace answer above as the response.</div>
          )}
          {a.evaluation.figuresNotInRecord.length > 0 && <div className="text-muted" style={{ fontSize: 11 }}>Figures checked against the record: {a.evaluation.figuresNotInRecord.join(", ")} not found in the trace or evidence register.</div>}
          <div className="text-muted" style={{ fontSize: 10 }}>Evaluated by {a.evaluation.model} · {new Date(a.at).toLocaleString()} · internal readiness only</div>
        </div>
      ))}

      {last?.evaluation.followUp && <div style={{ fontSize: 13, padding: "8px 12px", borderLeft: "3px solid var(--color-accent)" }}><span className="reply-label">Auditor follow-up</span>{last.evaluation.followUp}</div>}
      {last && !last.evaluation.followUp && <div className="text-muted" style={{ fontSize: 12 }}>No further follow-up — the record supports this line of questioning. You can still add another answer.</div>}

      <textarea className="input" rows={3} style={{ fontSize: 13 }} placeholder={modelOff ? "A language model must be configured to evaluate answers." : last ? "Answer the follow-up… / ตอบคำถามต่อเนื่อง…" : "How would you answer this auditor? / คุณจะตอบผู้ตรวจอย่างไร"} value={answer} disabled={busy || modelOff} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {busy ? (
          <>
            <span className="text-muted" style={{ fontSize: 12 }}>Judging your answer against the trace and evidence register with {ai.model.model}…</span>
            <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => abortRef.current?.abort()}><Square size={12} />Cancel</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!answer.trim() || modelOff} onClick={submit}>Evaluate my answer</button>
            {attempts.length > 0 && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => ai.clearRehearsal(q.id)}><RotateCcw size={12} />Start this question over</button>}
            <span className="text-muted" style={{ fontSize: 11 }}>Ctrl/⌘+Enter to submit. Figures you state are checked against the record.</span>
          </>
        )}
      </div>
      {error && <div className="callout" style={{ fontSize: 12 }}>{error}{error.toLowerCase().includes("cancel") ? "" : " — your answer is kept; retry, or fall back to the trace answer above."}</div>}
    </div>
  );
}
