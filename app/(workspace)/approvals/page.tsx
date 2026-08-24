"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ACCOUNTS,
  ACTIVITY,
  ADJUSTMENTS,
  ADVISOR_USER,
  FILINGS,
  INHOUSE_USER,
  ISSUES,
} from "@/lib/model";
import { useStore } from "@/lib/store";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { Amount } from "@/components/Amount";
import { eur } from "@/lib/format";
import { etrHref } from "@/lib/engine";

const STEPS = ["Imported", "Mapped", "Validated", "Calculated", "Prepared", "Reviewed", "Approved", "Filed", "Locked"];

export default function ApprovalsPage() {
  const { mode, flash, workflow, patchWorkflow, approvedMaps, ask, group } = useStore();
  const { calcs, t } = useCalc();
  const router = useRouter();
  const reviewer = mode === "advisor" ? ADVISOR_USER : INHOUSE_USER;
  const current = workflow.snapshotApproved ? 6 : workflow.girValidated ? 5 : 4;
  const [rowOk, setRowOk] = useState<Record<string, boolean>>({});

  const mapsPending = ACCOUNTS.filter((a) => !a.approved && !approvedMaps[a.account]);
  const adjOpen = ADJUSTMENTS.filter((a) => !a.reviewer);
  const blocks = ISSUES.filter((i) => i.severity === "block");
  const th = calcs.find((c) => c.iso === "TH") ?? calcs.find((c) => c.jurisdictionalTopUp > 0);

  const gates = [
    { ok: mapsPending.length === 0, label: "Account mapping approved", detail: mapsPending.length ? `${mapsPending.length} account below 80% confidence` : "All mapped accounts approved", href: "/mapping" },
    { ok: adjOpen.length === 0, label: "GloBE adjustments signed", detail: adjOpen.length ? `${adjOpen.length} without a reviewer` : "Art. 3.2 deltas reviewed", href: "/globe-income" },
    { ok: blocks.length === 0, label: "Blocking issues cleared", detail: blocks.length ? blocks.map((b) => b.title).join(" · ") : "No blocks on the issue list", href: "/issues" },
    { ok: workflow.reviewerRan, label: "AI reviewer run", detail: workflow.reviewerRan ? "Second-level review against current snapshot" : "Not yet run on this snapshot", href: "/issues" },
    { ok: workflow.girValidated, label: "GIR schema validated", detail: workflow.girValidated ? "0 errors · 2 warnings (VN DTA)" : "XML not yet validated", href: "/gir" },
  ];
  const gatesOpen = gates.filter((g) => !g.ok).length;

  const queue = useMemo(() => {
    const prepFor = (name: string) => FILINGS.find((f) => f.jurisdiction === name)?.preparer ?? "Group Tax";
    const revName = reviewer.name;
    const rows: {
      id: string;
      item: string;
      note: string;
      jur: string;
      prep: string;
      rev: string;
      ver: string;
      blocked: boolean;
      href: string;
    }[] = calcs
      .filter((c) => c.jurisdictionalTopUp > 0 || c.iso === "VN")
      .map((c) => {
        const blocked = ISSUES.some((i) => i.severity === "block" && i.jurisdiction === c.name);
        return {
          id: `jur-${c.blendKey}`,
          item: `${c.name} jurisdictional calculation`,
          note: blocked ? "Blocked by data gap — do not approve on estimates" : `Top-up ${eur(c.jurisdictionalTopUp)} · ETR trail on the amount`,
          jur: c.name,
          prep: prepFor(c.entities[0]?.jurisdiction ?? c.name),
          rev: blocked ? "—" : revName,
          ver: "v14",
          blocked,
          href: blocked ? "/issues" : etrHref(c),
        };
      });
    rows.push({
      id: "map-th",
      item: "Account mapping — Thailand",
      note: mapsPending.length ? `${mapsPending.map((a) => a.account).join(", ")} unapproved` : "All TH001 maps stored for subsequent years",
      jur: "Thailand",
      prep: "AI + N. Chai",
      rev: revName,
      ver: "map v6",
      blocked: mapsPending.length > 0,
      href: "/mapping",
    });
    rows.push({
      id: "adj-open",
      item: "Unsigned GloBE adjustments",
      note: adjOpen.length ? adjOpen.map((a) => `${a.id} ${a.category}`).join(" · ") : "All Art. 3.2 deltas have a reviewer",
      jur: "Group",
      prep: adjOpen[0]?.preparer ?? "—",
      rev: adjOpen.length ? "—" : revName,
      ver: "v14",
      blocked: adjOpen.length > 0,
      href: "/globe-income",
    });
    rows.push({
      id: "sh-elections",
      item: "Safe harbour elections",
      note: "US Side-by-Side / Transitional UTPR SH · Singapore simplified ETR in review",
      jur: "Group",
      prep: "Group Tax",
      rev: revName,
      ver: "v3",
      blocked: false,
      href: "/safe-harbours",
    });
    rows.push({
      id: "gir-c",
      item: "GIR sections C–D",
      note: workflow.girValidated ? "Schema validated · locked to snapshot v14" : "Section C missing 2 fields · D missing 1",
      jur: "Group",
      prep: "GIR Autopilot",
      rev: revName,
      ver: "v14",
      blocked: !workflow.girValidated,
      href: "/gir",
    });
    return rows;
  }, [calcs, mapsPending, adjOpen, reviewer.name, workflow.girValidated]);

  function statusOf(id: string, blocked: boolean) {
    if (blocked) return { label: "Blocked", cls: "tag-neutral" };
    if (workflow.snapshotApproved || rowOk[id]) return { label: "Approved", cls: "tag-accent" };
    return { label: "Awaiting approval", cls: "tag-outline" };
  }

  return (
    <div>
      <FlowBar />
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>FY2026 snapshot · {group.name}.</strong> Preparer / reviewer segregation is on.
          {mode === "advisor"
            ? " Advisor signs as engagement reviewer; client preparer remains on the entity."
            : " Group Tax Director is reviewer; local tax is preparer."}
          {" "}You are signing the calculation, not the GIR XML.
          {workflow.snapshotApproved ? " Snapshot is approved." : gatesOpen ? ` ${gatesOpen} gates still open.` : " Gates clear — ready for reviewer lock."}
        </div>
        <div className="stack-actions">
          <button className="btn btn-secondary" onClick={() => { patchWorkflow({ snapshotApproved: false }); setRowOk({}); flash("Returned to preparer with comments"); }}>Return</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              patchWorkflow({ snapshotApproved: true });
              flash(blocks.length ? "FY2026 calculation approved with documented exceptions (VN blocks remain)" : "FY2026 calculation approved (reviewer lock)");
            }}
          >
            Approve snapshot
          </button>
          <Link href="/gir" className="btn btn-secondary">GIR</Link>
          <Link href="/filings" className="btn btn-secondary">Filings</Link>
          <button className="btn btn-ghost" onClick={() => ask("What is still blocking FY2026 lock?")}>Ask GMT24</button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <span key={s} className={i <= current ? "status-in" : "status-out"}>{s}</span>
        ))}
      </div>

      <div style={{ display: "flex", border: "2px solid var(--color-divider)", marginBottom: 20 }}>
        <div style={{ flex: 1, padding: "22px 20px", borderRight: "1px solid var(--color-divider)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>Snapshot being signed · {group.fy}</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 42, lineHeight: 1, letterSpacing: "-0.03em", marginTop: 8 }}>
            <Amount n={t.topUp} audit={th?.audit} />
          </div>
          <div className="text-muted" style={{ marginTop: 8, fontSize: 13 }}>
            Group jurisdictional top-up · engine GMT24-CALC 2026.2 · click the amount for the trail
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <span className="tag tag-outline">Snapshot v14</span>
            <span className="tag tag-accent">Rule pack 2026.2</span>
            <span className="tag tag-neutral">Reviewer {reviewer.name}</span>
          </div>
        </div>
        <div style={{ width: "46%", flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[
            [String(t.tu), "Jurisdictions with top-up"],
            [String(blocks.length), "Blocking issues"],
            [String(gates.filter((g) => g.ok).length) + " / " + String(gates.length), "Review gates"],
            [workflow.snapshotApproved ? "Approved" : "Prepared", "Snapshot status"],
          ].map(([v, l]) => (
            <div key={l} style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-divider)", borderLeft: "1px solid var(--color-divider)" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h4>Review gates</h4>
            <Link href="/playbook/review" className="btn btn-ghost">Playbook</Link>
          </div>
          {gates.map((g) => (
            <Link
              key={g.label}
              href={g.href}
              style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--color-divider)", textDecoration: "none", color: "inherit" }}
            >
              <div>
                <strong>{g.label}</strong>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{g.detail}</div>
              </div>
              <span className={g.ok ? "tag tag-accent" : "tag tag-outline"} style={{ alignSelf: "center", flex: "none" }}>{g.ok ? "Clear" : "Open"}</span>
            </Link>
          ))}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h4>Sign-off trail</h4>
            <span className="text-muted">{reviewer.role}</span>
          </div>
          {ACTIVITY.map((a) => (
            <div key={a.text} style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-divider)" }}>
              <div style={{ fontSize: 13 }}>{a.text}</div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{a.who} · {a.when}</div>
            </div>
          ))}
          {workflow.snapshotApproved && (
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 13 }}>FY2026 calculation snapshot approved (reviewer lock)</div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>{reviewer.name} · now</div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h4>Approval queue</h4>
          <span className="text-muted">Item · preparer · reviewer · version</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Jurisdiction</th>
                <th>Preparer</th>
                <th>Reviewer</th>
                <th>Version</th>
                <th>Status</th>
                <th className="num"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => {
                const st = statusOf(q.id, q.blocked);
                return (
                  <tr key={q.id} className="clickable" onClick={() => router.push(q.href)}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{q.item}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{q.note}</div>
                    </td>
                    <td>{q.jur}</td>
                    <td>{q.prep}</td>
                    <td>{q.rev}</td>
                    <td className="mono">{q.ver}</td>
                    <td><span className={`tag ${st.cls}`}>{st.label}</span></td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      {q.blocked ? (
                        <Link href={q.href} className="btn btn-ghost" style={{ fontSize: 12 }}>View block</Link>
                      ) : st.label === "Approved" ? (
                        <span className="text-muted" style={{ fontSize: 12 }}>Approved</span>
                      ) : (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={() => { setRowOk((p) => ({ ...p, [q.id]: true })); flash(`${q.item} approved`); }}
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
        Approval locks this snapshot for the filing matrix. It does not file. Blocks stay on the issue list until source data arrives — GMT24 will not invent deferred tax or payroll.
        {" "}
        <Link href="/issues">Issues</Link>
        {" · "}
        <Link href="/audit">Audit trail</Link>
        {" · "}
        <Link href="/filings">Filings</Link>
        {" · "}
        <Link href="/host">Host desk</Link>
      </p>
    </div>
  );
}
