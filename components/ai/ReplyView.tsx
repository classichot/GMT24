"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, Check, Lock, X } from "lucide-react";
import { useAi } from "@/components/AiProvider";
import { permitted, POLICY } from "@/lib/ai/actions";
import { sectionTitle } from "@/lib/ai/i18n";
import { FEATURE_META, type ProposedAction, type Reply, type Section } from "@/lib/ai/types";

/** Renders one Co-Pilot reply: structured sections, citations, proposed actions, unsupported statements. */
export function ReplyView({ reply, compact }: { reply: Reply; compact?: boolean }) {
  return (
    <div className="reply">
      <div className="reply-head">
        <span className="tag tag-accent" style={{ fontSize: 10 }}>{FEATURE_META[reply.feature].name.replace(/^AI /, "")}</span>
        {reply.chips?.slice(1).map((c) => <span key={c} className="tag tag-neutral" style={{ fontSize: 10 }}>{c}</span>)}
        {reply.engine && <span className={`reply-engine ${reply.engine}`} title={reply.engine === "llm" ? `Composed by ${reply.model ?? "the language model"} from tool evidence${reply.toolsUsed?.length ? ` · tools: ${reply.toolsUsed.join(", ")}` : ""}` : "Deterministic module — no language model"}>{reply.engine === "llm" ? (reply.failed ? "model" : "AI · grounded") : "rules"}</span>}
        {!reply.grounded && !reply.failed && <span className="tag tag-warn" style={{ fontSize: 10 }}>partly ungrounded</span>}
        {reply.confidence && reply.confidence !== "high" && !reply.failed && <span className="tag tag-neutral" style={{ fontSize: 10 }}>confidence {reply.confidence}</span>}
      </div>
      {!compact && <h5 style={{ margin: "6px 0 4px" }}>{reply.title}</h5>}
      {reply.sections.map((s, i) => <SectionView key={i} s={s} lang={reply.lang} />)}
      {reply.unsupported.length > 0 && (
        <div className="reply-unsupported">
          <AlertTriangle size={12} />
          <div>
            <strong>Not tied to a source:</strong>
            <ul>{reply.unsupported.map((u, i) => <li key={i}>{u}</li>)}</ul>
          </div>
        </div>
      )}
      {reply.cites.length > 0 && (
        <div className="reply-cites">
          {reply.cites.map((c, i) => c.href ? (c.href.startsWith("http") ? <a key={i} href={c.href} target="_blank" rel="noreferrer" className="tag tag-outline"><BookOpen size={10} />{c.label}</a> : <Link key={i} href={c.href} className="tag tag-outline"><BookOpen size={10} />{c.label}</Link>) : <span key={i} className="tag tag-outline"><BookOpen size={10} />{c.label}</span>)}
        </div>
      )}
      {reply.actions.length > 0 && <Actions actions={reply.actions} />}
      <div className="reply-foot">{reply.version}{reply.latencyMs != null ? ` · ${(reply.latencyMs / 1000).toFixed(1)} s` : ""}{reply.model ? ` · ${reply.model}` : ""}{reply.steps && reply.steps > 1 ? ` · ${reply.steps} steps` : ""}{reply.tokens ? ` · ${reply.tokens.input + reply.tokens.output} tokens` : ""}</div>
    </div>
  );
}

function SectionView({ s, lang }: { s: Section; lang: Reply["lang"] }) {
  const title = s.title ?? (["text", "list", "steps", "table", "warning"].includes(s.kind) ? undefined : sectionTitle(s.kind, lang));
  if (s.kind === "warning") return <div className="reply-warn"><AlertTriangle size={13} /><span>{s.text}</span></div>;
  if (s.kind === "table") {
    return (
      <div className="reply-section">
        {title && <div className="reply-label">{title}</div>}
        <div className="table-wrap"><table className="table reply-table"><thead><tr>{s.head?.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{s.rows?.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      </div>
    );
  }
  return (
    <div className={`reply-section kind-${s.kind}`}>
      {title && <div className="reply-label">{title}</div>}
      {s.text && <p>{s.text}</p>}
      {s.items && s.items.length > 0 && (s.kind === "steps" ? <ol>{s.items.map((it, i) => <li key={i}>{it}</li>)}</ol> : <ul>{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>)}
    </div>
  );
}

export function Actions({ actions }: { actions: ProposedAction[] }) {
  const { ctx, run } = useAi();
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, { ok: boolean; message: string }>>({});
  return (
    <div className="reply-actions">
      {actions.map((a) => {
        const ok = permitted(a, ctx) && a.kind !== "external";
        const res = done[a.id];
        const immediate = a.kind === "navigate" || a.kind === "explain";
        return (
          <div key={a.id} className="reply-action">
            <button
              className={`btn ${a.kind === "approve" || a.kind === "save" ? "btn-secondary" : immediate ? "btn-ghost" : "btn-secondary"}`}
              style={{ fontSize: 12 }}
              disabled={!!res?.ok}
              onClick={() => { if (immediate) { const r = run(a); setDone((d) => ({ ...d, [a.id]: r })); } else setOpen(open === a.id ? null : a.id); }}
              title={a.preview}
            >
              {!ok && <Lock size={12} />}{res?.ok ? <Check size={12} /> : null}{a.label}{a.draft ? " (draft)" : ""}
            </button>
            {open === a.id && !immediate && (
              <div className="reply-preview">
                <div style={{ fontSize: 12 }}>{a.preview}</div>
                <div className="text-muted" style={{ fontSize: 11, marginTop: 6 }}>{POLICY[a.kind]}{!ok ? ` Requires ${a.requires}; your role is ${ctx.role}.` : ""}</div>
                <div className="stack-actions" style={{ marginTop: 8 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={!ok} onClick={() => { const r = run(a); setDone((d) => ({ ...d, [a.id]: r })); setOpen(null); }}>{a.kind === "approve" ? "Confirm and apply" : a.kind === "draft" ? "Create draft" : "Confirm"}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(null)}><X size={12} />Cancel</button>
                </div>
              </div>
            )}
            {res && !res.ok && <div className="reply-refused">{res.message}</div>}
          </div>
        );
      })}
    </div>
  );
}
