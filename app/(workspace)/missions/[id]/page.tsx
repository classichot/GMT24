"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import {
  AGI_MODE_META,
  APPROVAL_MODEL,
  CATEGORY_BY_ID,
  MISSION_GOVERNANCE,
  MISSION_LIFECYCLE,
  OUTCOME_BY_ID,
  missionById,
  missionGovernance,
  missionMode,
} from "@/lib/missions";

export default function MissionDetail() {
  const params = useParams<{ id: string }>();
  const { group, activeFy } = useStore();
  const ai = useAi();
  const m = missionById(params.id);

  if (!m) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <p className="text-muted">Unknown mission id “{params.id}”.</p>
        <Link href="/missions" className="btn btn-secondary" style={{ width: "fit-content" }}><ArrowLeft size={14} />Back to the mission catalog</Link>
      </div>
    );
  }

  const cat = CATEGORY_BY_ID[m.categoryId];
  const outcome = OUTCOME_BY_ID[m.outcome];
  const mode = missionMode(m);
  const gov = missionGovernance(m);
  const orchestrated = (m.orchestrates ?? []).map((id) => missionById(id)).filter(Boolean);

  const jurisdiction = m.appHref?.startsWith("/thailand") || m.id === "OUT-06" ? "Thailand" : "Group-wide (48 jurisdictions)";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/missions" className="btn btn-ghost" style={{ fontSize: 12 }}><ArrowLeft size={13} />Mission catalog</Link>
        <span className="text-muted" style={{ fontSize: 12 }}>/ {cat.section}. {cat.title}</span>
      </div>

      <div className="callout" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div className="text-muted" style={{ fontSize: 11 }}>{m.id}{m.wow ? " · wow mission" : ""}</div>
          <strong style={{ fontSize: 18 }}>{m.wow ?? m.title}</strong>
          {m.output && <div className="text-muted" style={{ marginTop: 4 }}>Main output: {m.output}</div>}
          {m.note && <div className="text-muted" style={{ marginTop: 4 }}>{m.note}</div>}
          <div className="stack-actions" style={{ marginTop: 10 }}>
            <span className="tag tag-outline" style={{ fontSize: 10 }} title={AGI_MODE_META[mode].blurb}>AGI · {AGI_MODE_META[mode].label}</span>
            <span className="tag tag-neutral" style={{ fontSize: 10 }}>Outcome {outcome.n} · {outcome.short}</span>
            {m.mvp && <span className="tag tag-ok" style={{ fontSize: 10 }}>MVP launch set</span>}
          </div>
        </div>
        <div className="stack-actions">
          {m.appHref && <Link href={m.appHref} className="btn btn-primary" style={{ fontSize: 13 }}>Run mission<ArrowRight size={14} /></Link>}
          <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => ai.ask(`Explain the mission ${m.id} — ${m.title}`)}>Ask GMT24</button>
        </div>
      </div>

      {/* Lifecycle */}
      <div className="panel">
        <div className="panel-head"><h5>Status</h5><span className="tag tag-accent" style={{ fontSize: 10 }}>{gov.status}</span></div>
        <div className="panel-body" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {MISSION_LIFECYCLE.map((s, i) => {
            const done = MISSION_LIFECYCLE.indexOf(gov.status) >= i;
            return (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className={`tag ${done ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 11 }}>
                  {done && <CheckCircle2 size={11} style={{ marginRight: 4 }} />}{s}
                </span>
                {i < MISSION_LIFECYCLE.length - 1 && <ArrowRight size={12} color="var(--color-neutral-600)" />}
              </span>
            );
          })}
        </div>
      </div>

      {/* Governance card */}
      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>Mission governance card</h5><span className="tag tag-neutral" style={{ fontSize: 10 }}>required for every mission</span></div>
          <div className="table-wrap">
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                <Row k="Group / entity / jurisdiction / FY" v={`${group.name} · UPE ${group.upe} · ${jurisdiction} · ${activeFy}`} />
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
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div className="panel">
            <div className="panel-head"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={14} color="var(--color-accent)" /><h5>Approval model</h5></div></div>
            <div className="panel-body">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: "grid", gap: 8 }}>
                {APPROVAL_MODEL.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          </div>

          {orchestrated.length > 0 && (
            <div className="panel">
              <div className="panel-head"><h5>Orchestrated specialist missions</h5><span className="tag tag-neutral" style={{ fontSize: 10 }}>{orchestrated.length}</span></div>
              <div className="panel-body" style={{ display: "grid", gap: 8 }}>
                {orchestrated.map((o) => o && (
                  <Link key={o.id} href={`/missions/${o.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, textDecoration: "none", color: "inherit", borderBottom: "1px solid var(--color-divider)", paddingBottom: 6 }}>
                    <span><span className="text-muted">{o.id}</span> · {o.title}</span>
                    <ArrowRight size={13} color="var(--color-accent)" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-muted" style={{ fontSize: 12 }}>
        No LLM posts a Pillar Two number in this mission. The AGI plans, extracts, reconciles, explains and drafts; the deterministic GMT24 engine performs every calculation and stamps the versions above so the result stays reproducible when OECD guidance or the GIR schema changes.
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="text-muted" style={{ width: 240, verticalAlign: "top" }}>{k}</td>
      <td>{v}</td>
    </tr>
  );
}
