"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Rocket, ShieldCheck } from "lucide-react";
import { useAgi } from "@/lib/agi/useAgi";
import { WORK_MODE_LABEL } from "@/lib/agi/specialists";
import {
  APPROVAL_MODEL,
  CATEGORY_BY_ID,
  MISSION_GOVERNANCE,
  MISSION_LIFECYCLE,
  OUTCOME_BY_ID,
  missionById,
  missionGovernance,
  missionMode,
} from "@/lib/agi/catalog";

export default function MissionCardPage() {
  const params = useParams<{ id: string }>();
  const agi = useAgi();
  const live = agi.live;
  const m = missionById(params.id);

  if (!m) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ color: "var(--color-neutral-600)" }}>Unknown mission id “{params.id}”.</p>
        <Link href="/agi/missions" className="btn btn-secondary" style={{ width: "fit-content" }}><ArrowLeft size={14} />Back to the mission catalog</Link>
      </div>
    );
  }

  const cat = CATEGORY_BY_ID[m.categoryId];
  const outcome = OUTCOME_BY_ID[m.outcome];
  const mode = missionMode(m);
  const gov = missionGovernance(m);
  const orchestrated = (m.orchestrates ?? []).map((id) => missionById(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const jurisdiction = m.appHref?.startsWith("/thailand") || m.id === "OUT-06" ? "Thailand" : `Group-wide (${live.jurisdictions.length} jurisdictions)`;
  const statusIndex = MISSION_LIFECYCLE.indexOf(gov.status);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/agi/missions" className="btn btn-ghost" style={{ fontSize: 12 }}><ArrowLeft size={13} />Mission catalog</Link>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>/ {cat.section}. {cat.title}</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="agi-mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{m.id}{m.wow ? " · wow mission" : ""}</div>
          <h2 style={{ margin: "2px 0 0" }}>{m.wow ?? m.title}</h2>
          {m.output && <div style={{ color: "var(--color-neutral-600)", marginTop: 4 }}>Main output: {m.output}</div>}
          {m.note && <div style={{ color: "var(--color-neutral-600)", marginTop: 4, fontSize: 13 }}>{m.note}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <span className="tag tag-outline" style={{ fontSize: 10 }} title={WORK_MODE_LABEL[mode].blurb}>AGI · {WORK_MODE_LABEL[mode].label}</span>
            <span className="tag tag-neutral" style={{ fontSize: 10 }}>Outcome {outcome.n} · {outcome.short}</span>
            {m.mvp && <span className="tag tag-ok" style={{ fontSize: 10 }}>MVP launch set</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {m.appHref && <Link href={m.appHref} className="btn btn-primary" style={{ fontSize: 13 }}>Run mission<ArrowRight size={14} /></Link>}
          <Link href="/agi" className="btn btn-secondary" style={{ fontSize: 13 }}><Rocket size={14} />Assign in Mission Control</Link>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h4>Status</h4><span className="tag tag-accent">{gov.status}</span></div>
        <div className="panel-body" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {MISSION_LIFECYCLE.map((s, i) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className={`tag ${statusIndex >= i ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 11 }}>
                {statusIndex >= i && <CheckCircle2 size={11} style={{ marginRight: 4 }} />}{s}
              </span>
              {i < MISSION_LIFECYCLE.length - 1 && <ArrowRight size={12} color="var(--color-neutral-600)" />}
            </span>
          ))}
        </div>
      </section>

      <div className="agi-two">
        <section className="panel">
          <div className="panel-head"><h4>Mission governance card</h4><span className="tag tag-outline">required for every mission</span></div>
          <div className="panel-body" style={{ fontSize: 13, overflowX: "auto" }}>
            <table className="table">
              <tbody>
                <Row k="Group / entity / jurisdiction / FY" v={`${live.groupName} · UPE ${live.upeIso} · ${jurisdiction} · ${live.fy}`} />
                <Row k="Rulebook and local-law version" v={`${MISSION_GOVERNANCE.rulebook} · ${MISSION_GOVERNANCE.localLaw}`} />
                <Row k="GIR / filing-schema version" v={MISSION_GOVERNANCE.girSchema} />
                <Row k="Input sources & evidence coverage" v={`Close pack · CbCR · certificates — ${gov.evidenceCoverage}% coverage`} />
                <Row k="Assigned AI agent / specialist team" v={gov.agent} />
                <Row k="Assumptions & unresolved questions" v={m.mvp ? "None open on this snapshot" : "Pending reviewer confirmation of extracted facts"} />
                <Row k="Calculation & validation results" v={m.outcome === "calculate" ? "Engine-posted, deterministic, reconciled" : "Deterministic engine + rule checks"} />
                <Row k="Risk level & estimated tax impact" v={`${gov.risk} · ${gov.taxImpact}`} />
                <Row k="Human approver" v={gov.approver} />
                <Row k="AI usage & mission credits" v={`${gov.credits} credits · execution log retained`} />
                <Row k="Final status" v={`${gov.status} (Draft → Reviewed → Approved → Filed → Locked)`} />
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="panel">
            <div className="panel-head"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={14} color="var(--color-accent)" /><h4>Approval model</h4></div></div>
            <div className="panel-body">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: "grid", gap: 8 }}>
                {APPROVAL_MODEL.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          </section>

          {orchestrated.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h4>Orchestrated specialist missions</h4><span className="tag tag-neutral">{orchestrated.length}</span></div>
              <div className="panel-body" style={{ display: "grid", gap: 8, fontSize: 12 }}>
                {orchestrated.map((o) => (
                  <Link key={o.id} href={`/agi/missions/${o.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, textDecoration: "none", color: "inherit", borderBottom: "1px solid var(--color-divider)", paddingBottom: 6 }}>
                    <span><span className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{o.id}</span> · {o.title}</span>
                    <ArrowRight size={13} color="var(--color-accent)" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
        No LLM posts a Pillar Two number in this mission. The AGI department plans, extracts, reconciles, explains and drafts; the deterministic GMT24 engine performs every calculation and stamps the versions above so the result stays reproducible when OECD guidance or the GIR schema changes.
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td style={{ width: 240, verticalAlign: "top", color: "var(--color-neutral-600)" }}>{k}</td>
      <td>{v}</td>
    </tr>
  );
}
