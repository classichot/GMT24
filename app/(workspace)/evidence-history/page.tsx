"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { eur } from "@/lib/format";
import {
  HISTORY_KINDS,
  formatWhen,
  kindTag,
  type HistoryKind,
} from "@/lib/evidenceHistory";

export default function EvidenceHistoryPage() {
  const {
    group,
    activeFy,
    historyEvents,
    historyImmutable,
    historyChainOk,
    appendHistory,
    setHistoryImmutable,
    deleteHistoryEvent,
    resetHistory,
    flash,
    ask,
  } = useStore();
  const [kind, setKind] = useState<HistoryKind | "all">("all");
  const [q, setQ] = useState("");
  const [newest, setNewest] = useState(false);
  const [note, setNote] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = historyEvents.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (!needle) return true;
      return `${e.title} ${e.detail} ${e.actor} ${e.ref ?? ""}`.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) => {
      const d = a.at.localeCompare(b.at) || a.seq - b.seq;
      return newest ? -d : d;
    });
  }, [historyEvents, kind, q, newest]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: historyEvents.length };
    for (const e of historyEvents) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [historyEvents]);

  function postComment() {
    const text = note.trim();
    if (!text) {
      flash("Write a comment first");
      return;
    }
    appendHistory({
      kind: "comment",
      title: text.length > 80 ? `${text.slice(0, 77)}…` : text,
      detail: text,
      href: "/evidence-history",
    });
    setNote("");
    flash("Comment appended to the chronicle");
  }

  function onDelete(id: string) {
    const err = deleteHistoryEvent(id);
    flash(err ?? "Entry removed · chain rebuilt");
  }

  function onReset(mode: "working" | "seed") {
    const err = resetHistory(mode);
    flash(err ?? (mode === "working" ? "Working entries cleared · seed kept" : "Chronicle reset to seed"));
  }

  return (
    <div>
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Evidence history · {group.name} · {activeFy}.</strong> One chronicle for documents, mapping and election changes, engine calculations, user actions and comments.
          {" "}Each row carries a hash of the previous row. Immutability seals the log: nothing can be edited or deleted, but new entries still append.
        </div>
        <div className="stack-actions">
          <Link href="/evidence" className="btn btn-secondary">Evidence locker</Link>
          <Link href="/audit" className="btn btn-secondary">Audit trail</Link>
          <button className="btn btn-ghost" onClick={() => ask("How does evidence history stay immutable?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Immutability</h4>
            <span className={historyImmutable ? "tag tag-accent" : "tag tag-outline"}>{historyImmutable ? "On · sealed" : "Off · writable"}</span>
          </div>
          <div className="panel-body">
            <div className="seg" style={{ width: "100%", marginBottom: 12 }}>
              <label className="seg-opt" style={{ flex: 1 }}>
                <input type="radio" name="eh-imm" checked={historyImmutable} onChange={() => { setHistoryImmutable(true); flash("Chronicle sealed"); }} />
                On
              </label>
              <label className="seg-opt" style={{ flex: 1 }}>
                <input type="radio" name="eh-imm" checked={!historyImmutable} onChange={() => { setHistoryImmutable(false); flash("Chronicle writable — deletes rebuild the hash chain"); }} />
                Off
              </label>
            </div>
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              {historyImmutable
                ? "WORM mode. You can still post comments and the engine will keep logging actions. You cannot delete or reset."
                : "Working mode. Delete a row or reset the working log. Turn On again to re-seal whatever remains."}
            </p>
            {!historyImmutable && (
              <div className="stack-actions" style={{ marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={() => onReset("working")}>Clear working log</button>
                <button className="btn btn-ghost" onClick={() => onReset("seed")}>Reset to seed</button>
              </div>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Integrity</h4>
            <span className={historyChainOk ? "tag tag-accent" : "tag tag-hot"}>{historyChainOk ? "Chain intact" : "Chain broken"}</span>
          </div>
          <div className="panel-body">
            <div className="wf-row"><span>Entries</span><span>{historyEvents.length}</span></div>
            <div className="wf-row"><span>Genesis</span><span className="mono">GMT24-EH-v1</span></div>
            <div className="wf-row"><span>Tip hash</span><span className="mono">{historyEvents.length ? historyEvents[historyEvents.length - 1].hash.slice(0, 8) : "—"}</span></div>
            <p className="text-muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
              {historyChainOk
                ? "Each hash covers the prior hash plus actor, time, kind, title and detail. Tampering local storage breaks the chain."
                : "A row no longer matches its stamp. Turn immutability off and Reset to seed to restore a clean chronicle."}
            </p>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head"><h4>Add comment</h4><span className="text-muted">Appends even when sealed</span></div>
        <div className="panel-body">
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note, exception, or file pointer. This becomes a permanent row if immutability stays on." />
          <div className="stack-actions" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={postComment}>Post to chronicle</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <h4>Chronicle</h4>
          <div className="stack-actions">
            <input className="input" style={{ minHeight: 32, width: 200 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, file, ref…" />
            <button className="btn btn-ghost" onClick={() => setNewest((v) => !v)}>{newest ? "Oldest first" : "Newest first"}</button>
          </div>
        </div>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-divider)", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {HISTORY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={kind === k.id ? "tag tag-accent" : "tag tag-outline"}
              onClick={() => setKind(k.id)}
              style={{ cursor: "pointer", border: kind === k.id ? undefined : "1px solid var(--color-accent)" }}
            >
              {k.label} {counts[k.id] ?? 0}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="panel-body"><p className="text-muted" style={{ margin: 0 }}>No rows in this filter.</p></div>
        ) : (
          rows.map((e) => {
            const tag = kindTag(e.kind);
            return (
              <div key={e.id} className="eh-row">
                <div className="eh-rail">
                  <div className="mono" style={{ fontSize: 11 }}>{formatWhen(e.at)}</div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{e.fy} · #{e.seq}</div>
                  <span className={`tag ${tag.cls}`} style={{ marginTop: 8 }}>{tag.label}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{e.title}</div>
                  <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{e.detail}</div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12 }}>
                    <span>{e.actor} · {e.role}</span>
                    {e.amount != null && <span className="mono">{eur(e.amount, true)}</span>}
                    {e.ref && <span className="mono text-muted">{e.ref}</span>}
                    <span className="mono text-muted" title={e.hash}>{e.hash.slice(0, 8)}</span>
                    {e.href && <Link href={e.href}>Open</Link>}
                    {!historyImmutable && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onDelete(e.id)}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
