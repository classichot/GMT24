"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, FileCheck2, Paperclip } from "lucide-react";
import { FlowBar } from "@/components/FlowBar";
import { ScoreBar, SeverityTag, StatusTag } from "@/components/XrayBits";
import { useStore } from "@/lib/store";
import { useXray } from "@/lib/useXray";
import { eur, pct } from "@/lib/format";
import {
  ENGINE_META,
  activeQuestions,
  amountAtRisk,
  branchImpact,
  calcFor,
  missingEvidence,
  selectedBranch,
  type XrayDept,
  type XrayFinding,
} from "@/lib/xray";

const DEPTS: XrayDept[] = [
  "Finance",
  "Tax",
  "HR",
  "Legal",
  "Treasury",
  "Fixed assets",
  "BOI / project",
  "Local subsidiary",
];

function ConfirmWorkflow() {
  const params = useSearchParams();
  const { xray, answerXray, attachXrayEvidence, signXray, flash, mode } = useStore();
  const { findings, statuses, areas, overall, stop, calcs } = useXray();
  const [dept, setDept] = useState<XrayDept | "all">("all");
  const [picked, setPicked] = useState<string | null>(null);

  const queue = useMemo(() => {
    const list = dept === "all" ? findings : findings.filter((f) => f.dept === dept);
    return [...list]
      .map((f) => ({ f, risk: amountAtRisk(f, calcs), status: statuses[f.id] }))
      .sort((a, b) => {
        const openA = a.status === "resolved" ? 1 : 0;
        const openB = b.status === "resolved" ? 1 : 0;
        return openA - openB || b.risk - a.risk;
      });
  }, [findings, dept, statuses, calcs]);

  const fromUrl = params.get("f");
  const activeId = picked ?? fromUrl ?? queue[0]?.f.id ?? null;
  const finding = findings.find((f) => f.id === activeId) ?? null;

  return (
    <div>
      <FlowBar />

      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 700 }}>
          <strong>Smart confirmation workflow.</strong> Questions are generated from the accounts and transactions
          actually detected, not from a standard questionnaire, and they are conditional — answering one can retire
          the rest. Each answer is priced against the live calculation before anyone chases it.
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="kpi-label">Overall confidence</div>
            <ScoreBar score={overall} />
          </div>
          <Link href="/xray" className="btn btn-secondary">Command centre</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button className={dept === "all" ? "chip active" : "chip"} onClick={() => setDept("all")}>
          All teams ({findings.length})
        </button>
        {DEPTS.map((d) => {
          const n = findings.filter((f) => f.dept === d).length;
          if (!n) return null;
          const open = findings.filter((f) => f.dept === d && statuses[f.id] !== "resolved").length;
          return (
            <button key={d} className={dept === d ? "chip active" : "chip"} onClick={() => setDept(d)}>
              {d} ({open}/{n})
            </button>
          );
        })}
      </div>

      <div className="grid-score" style={{ alignItems: "start" }}>
        <div className="panel" style={{ maxHeight: 720, overflow: "auto" }}>
          <div className="panel-head">
            <h4>Queue</h4>
            <span className="text-muted">{queue.length}</span>
          </div>
          {queue.map(({ f, risk, status }) => (
            <button
              key={f.id}
              onClick={() => setPicked(f.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                padding: "12px 14px",
                border: 0,
                borderBottom: "1px solid var(--color-divider)",
                borderLeft: `3px solid ${f.id === activeId ? "var(--color-accent)" : "transparent"}`,
                background: f.id === activeId ? "color-mix(in srgb, var(--color-accent-100) 60%, transparent)" : "transparent",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="mono" style={{ fontSize: 11 }}>{f.entityCode}</span>
                <StatusTag status={status} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{f.title}</div>
              <div className="text-muted" style={{ fontSize: 11, marginTop: 3 }}>
                {ENGINE_META[f.engine].name} · {f.dept}{risk ? ` · ${eur(risk, true)} at risk` : ""}
              </div>
            </button>
          ))}
        </div>

        {finding ? <Detail key={finding.id} finding={finding} /> : (
          <div className="panel">
            <div className="panel-body">Nothing in this queue.</div>
          </div>
        )}
      </div>

      <p className="text-muted" style={{ marginTop: 16, fontSize: 13 }}>
        {stop.blocked
          ? `${stop.reasons.length} material item${stop.reasons.length === 1 ? "" : "s"} still block final approval. `
          : "All material items are confirmed, supported and reviewed. "}
        Confidence is now {overall}% overall, with{" "}
        {areas.filter((a) => a.score < 90).length} area{areas.filter((a) => a.score < 90).length === 1 ? "" : "s"} below 90%.
        {" "}
        <Link href="/xray">Command centre</Link>
        {" · "}
        <Link href="/approvals">Approvals</Link>
        {" · "}
        <Link href="/evidence-history">Evidence history</Link>
      </p>
    </div>
  );

  function Detail({ finding: f }: { finding: XrayFinding }) {
    const r = xray[f.id];
    const answers = r?.answers ?? {};
    const active = activeQuestions(f, answers);
    const status = statuses[f.id];
    const calc = calcFor(f, calcs);
    const chosen = selectedBranch(f, answers);
    const missing = missingEvidence(f, r);
    const risk = amountAtRisk(f, calcs);

    return (
      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h4>{f.title}</h4>
            <span style={{ display: "flex", gap: 6 }}>
              <SeverityTag severity={f.severity} />
              <StatusTag status={status} />
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span className="tag tag-outline">{ENGINE_META[f.engine].name}</span>
              <span className="tag tag-neutral">{f.entityCode} · {f.jurisdiction}</span>
              <Link href="/rulebook" className="tag tag-accent">{f.article}</Link>
              <span className="tag tag-outline">Routed to {f.dept}</span>
            </div>
            <p style={{ marginTop: 0 }}><strong>Detected.</strong> {f.detected}</p>
            <p><strong>What the data cannot prove.</strong> {f.missing}</p>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Source: {f.sourceDoc} · owner {f.owner} · amount affected {f.amount ? eur(f.amount) : "—"}
              {risk ? ` · ${eur(risk)} of top-up tax depends on the answer` : ""}
              {" · "}
              <Link href={f.href}>open the calculation</Link>
            </p>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h4>Confirmation</h4>
            <span className="text-muted">{active.filter((q) => answers[q.id]).length} of {active.length} answered</span>
          </div>
          <div className="panel-body">
            {active.map((q, i) => (
              <div key={q.id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: i < active.length - 1 ? "1px solid var(--color-divider)" : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{q.prompt}</strong>
                  <span className="tag tag-outline" style={{ flex: "none" }}>{q.dept}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {q.options.map((o) => {
                    const on = answers[q.id] === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => answerXray(f.id, q.id, o.value)}
                        className={on ? "btn btn-primary" : "btn btn-secondary"}
                        style={{ fontSize: 12 }}
                      >
                        {on ? <Check size={14} /> : null}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {q.dependsOn ? (
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                    Asked only because of the answer above — it disappears if that changes.
                  </div>
                ) : null}
              </div>
            ))}
            {f.questions.length > active.length ? (
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 0 }}>
                {f.questions.length - active.length} further question
                {f.questions.length - active.length === 1 ? "" : "s"} retired by the answers given — conditional
                logic keeps the request to what actually applies.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h4>Live impact</h4>
            <span className="text-muted">Priced against the current {f.jurisdiction} calculation</span>
          </div>
          {calc ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>If confirmed</th>
                    <th>Treatment</th>
                    <th className="num">GloBE income</th>
                    <th className="num">ETR</th>
                    <th className="num">Top-up</th>
                    <th className="num">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {f.branches.map((b) => {
                    const im = branchImpact(calc, b);
                    const on = chosen?.value === b.value;
                    return (
                      <tr key={b.value} style={on ? { background: "color-mix(in srgb, var(--color-accent-100) 60%, transparent)" } : undefined}>
                        <td style={{ fontWeight: on ? 800 : 600, whiteSpace: "nowrap" }}>
                          {on ? "✓ " : ""}{b.label}
                        </td>
                        <td className="text-muted" style={{ fontSize: 12, maxWidth: 340 }}>{b.treatment}</td>
                        <td className="num">{eur(im.globeIncome, true)}</td>
                        <td className="num">{calc.globeIncome > 0 ? pct(im.etr, 2) : "N/A (Loss)"}</td>
                        <td className="num">{eur(im.topUp, true)}</td>
                        <td className="num" style={{ fontWeight: 800, color: im.topUpDelta > 0 ? "var(--color-hot)" : im.topUpDelta < 0 ? "var(--color-ok)" : undefined }}>
                          {im.topUpDelta === 0 ? "—" : `${im.topUpDelta > 0 ? "+" : "−"}${eur(Math.abs(im.topUpDelta), true).replace("$", "$")}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-body text-muted">This entity does not sit in a calculated blend on the current snapshot.</div>
          )}
          <div className="panel-body">
            <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
              Current position: GloBE income {calc ? eur(calc.globeIncome, true) : "—"}, ETR{" "}
              {calc && calc.globeIncome > 0 ? pct(calc.etr, 2) : "N/A (Loss)"}, top-up{" "}
              {calc ? eur(calc.jurisdictionalTopUp, true) : "—"}. The spread across the answers is the reason to
              chase this confirmation — or to leave it.
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h4>Evidence validation</h4>
              <span className="text-muted">{f.evidence.length - missing.length} of {f.evidence.length}</span>
            </div>
            {f.evidence.map((e) => {
              const have = !missing.includes(e);
              return (
                <div key={e} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--color-divider)", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>{e}</span>
                  {have ? (
                    <span className="tag tag-accent" style={{ flex: "none" }}>Validated</span>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, flex: "none" }}
                      onClick={() => { attachXrayEvidence(f.id, e); flash(`${e} validated against ${f.entityCode}`); }}
                    >
                      <Paperclip size={13} />Attach
                    </button>
                  )}
                </div>
              );
            })}
            <div className="panel-body">
              <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                Extracted values are validated against the source document before they reach the calculation. An
                item cannot be signed while any required document is absent.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h4>Approval</h4>
              <span className="text-muted">Preparer then reviewer</span>
            </div>
            <div className="panel-body">
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13 }}>Preparer</span>
                  <strong style={{ fontSize: 13 }}>{r?.preparer ?? "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13 }}>Reviewer</span>
                  <strong style={{ fontSize: 13 }}>{r?.reviewer ?? "—"}</strong>
                </div>
              </div>
              <div className="stack-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const err = signXray(f.id, "preparer");
                    flash(err ?? `Preparer signed · ${f.entityCode}`);
                  }}
                >
                  <FileCheck2 size={15} />Sign as preparer
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const err = signXray(f.id, "reviewer");
                    flash(err ?? `Reviewer approved · ${f.entityCode}`);
                  }}
                >
                  <Check size={15} />Approve as reviewer
                </button>
              </div>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 12 }}>
                Signing is refused while a question is unanswered or a document is missing, and the reviewer must be a
                different person from the preparer — switch operating mode to review your own preparation. You are
                currently acting in {mode === "advisor" ? "Advisor" : "In-house"} mode.
              </p>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h4>Proof required</h4>
            <span className="text-muted">What {f.dept} must produce to close this</span>
          </div>
          <div className="panel-body">
            <p style={{ margin: 0 }}>{f.proofRequired}</p>
          </div>
        </div>
      </div>
    );
  }
}

export default function XrayConfirmPage() {
  return (
    <Suspense fallback={<div className="panel"><div className="panel-body">Loading confirmations…</div></div>}>
      <ConfirmWorkflow />
    </Suspense>
  );
}
