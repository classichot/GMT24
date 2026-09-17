"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Target, Users, Workflow, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import {
  AGI_MODE_META,
  CATEGORIES,
  CATEGORY_BY_ID,
  MASTER_MISSIONS,
  MISSIONS,
  MISSION_GOVERNANCE,
  MVP_MISSIONS,
  OUTCOMES,
  OUTCOME_BY_ID,
  WOW_MISSIONS,
  missionMode,
  outcomeCount,
  type AgiMode,
  type Mission,
  type OutcomeId,
} from "@/lib/missions";

const MODE_ICON: Record<AgiMode, typeof Users> = {
  single: User,
  team: Users,
  swarm: Workflow,
};

function ModeTag({ mode }: { mode: AgiMode }) {
  const Icon = MODE_ICON[mode];
  return (
    <span className="tag tag-outline" style={{ fontSize: 10, gap: 4 }} title={AGI_MODE_META[mode].blurb}>
      <Icon size={11} />
      {AGI_MODE_META[mode].label}
    </span>
  );
}

export default function MissionsPage() {
  const { group, activeFy } = useStore();
  const ai = useAi();
  const [outcome, setOutcome] = useState<OutcomeId | "all">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [q, setQ] = useState("");

  const specialistCategories = CATEGORIES.filter((c) => !c.master);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return MISSIONS.filter((m) => m.categoryId !== "master")
      .filter((m) => outcome === "all" || m.outcome === outcome)
      .filter((m) => categoryId === "all" || m.categoryId === categoryId)
      .filter((m) => !query || `${m.id} ${m.title} ${m.wow ?? ""}`.toLowerCase().includes(query));
  }, [outcome, categoryId, q]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="callout" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <strong>GMT24 AGI mode — one catalog, four outcomes.</strong>
          <div className="text-muted" style={{ marginTop: 4 }}>
            You pick a <strong>Master Outcome Mission</strong>; the AGI orchestrates the specialist missions automatically as a Single agent, a Team, or a Swarm. The deterministic engine still posts every Pillar Two number — the AGI plans, extracts, explains and drafts. Every mission is stamped with its rulebook, jurisdiction-law and GIR-schema versions because OECD guidance keeps changing.
          </div>
          <div className="stack-actions" style={{ marginTop: 10 }}>
            <span className="tag tag-neutral" style={{ fontSize: 10 }}>{MISSION_GOVERNANCE.rulebook}</span>
            <span className="tag tag-neutral" style={{ fontSize: 10 }}>{MISSION_GOVERNANCE.localLaw}</span>
            <span className="tag tag-neutral" style={{ fontSize: 10 }}>{MISSION_GOVERNANCE.girSchema}</span>
          </div>
        </div>
        <div className="stack-actions">
          <button className="btn btn-secondary" onClick={() => ai.ask("What is AGI mode and how do missions work?")}><Sparkles size={14} />Ask GMT24</button>
        </div>
      </div>

      <div className="kpi-grid cols-4">
        <div className="kpi"><div className="kpi-label">Missions</div><div className="kpi-val">{MISSIONS.length}</div><div className="kpi-sub">{MASTER_MISSIONS.length} master · {MISSIONS.length - MASTER_MISSIONS.length} specialist</div></div>
        <div className="kpi"><div className="kpi-label">Outcomes</div><div className="kpi-val">{OUTCOMES.length}</div><div className="kpi-sub">every mission maps to one</div></div>
        <div className="kpi"><div className="kpi-label">MVP launch set</div><div className="kpi-val">{MVP_MISSIONS.length}</div><div className="kpi-sub">strongest first release</div></div>
        <div className="kpi"><div className="kpi-label">Wow missions</div><div className="kpi-val">{WOW_MISSIONS.length}</div><div className="kpi-sub">headline differentiators</div></div>
      </div>

      {/* Four outcomes */}
      <div>
        <div className="nav-group" style={{ padding: "0 0 8px" }}>The four outcomes</div>
        <div className="grid-2">
          {OUTCOMES.map((o) => (
            <div key={o.id} className="panel">
              <div className="panel-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Target size={15} color="var(--color-accent)" />
                  <div><h5>{o.n}. {o.title}</h5></div>
                </div>
                <span className="tag tag-accent" style={{ fontSize: 10 }}>{outcomeCount(o.id)} missions</span>
              </div>
              <div className="panel-body" style={{ fontSize: 13 }}>{o.blurb}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Master outcome missions */}
      <div>
        <div className="nav-group" style={{ padding: "0 0 8px" }}>Master Outcome Missions · what users see first</div>
        <div className="grid-3">
          {MASTER_MISSIONS.map((m) => (
            <MasterCard key={m.id} m={m} />
          ))}
        </div>
      </div>

      {/* MVP launch set */}
      <div className="panel">
        <div className="panel-head"><h5>Recommended MVP launch set</h5><span className="tag tag-accent" style={{ fontSize: 10 }}>{MVP_MISSIONS.length} missions</span></div>
        <div className="panel-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MVP_MISSIONS.map((m) => (
            <Link key={m.id} href={`/missions/${m.id}`} className="chip" style={{ fontSize: 12 }} title={m.title}>
              <span className="text-muted" style={{ fontSize: 10 }}>{m.id}</span>&nbsp;{m.wow ?? m.title}
            </Link>
          ))}
        </div>
      </div>

      {/* Wow missions */}
      <div className="panel">
        <div className="panel-head"><h5>Wow missions</h5><span className="tag tag-neutral" style={{ fontSize: 10 }}>{WOW_MISSIONS.length}</span></div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th>Mission</th><th>Where</th><th>AGI mode</th><th /></tr></thead>
            <tbody>
              {WOW_MISSIONS.map((m) => (
                <tr key={m.id} className="clickable">
                  <td><strong>{m.wow}</strong><div className="text-muted" style={{ fontSize: 11 }}>{m.id} · {CATEGORY_BY_ID[m.categoryId].title}</div></td>
                  <td className="text-muted">{OUTCOME_BY_ID[m.outcome].short}</td>
                  <td><ModeTag mode={missionMode(m)} /></td>
                  <td style={{ textAlign: "right" }}><Link href={`/missions/${m.id}`} className="btn btn-ghost" style={{ fontSize: 12 }}>Open<ArrowRight size={13} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Specialist mission browser */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <div><h5>Specialist mission catalog</h5><div className="text-muted" style={{ fontSize: 11 }}>The underlying missions the AGI orchestrates. {group.name} · {activeFy}.</div></div>
          <span className="text-muted" style={{ fontSize: 11 }}>{rows.length} of {MISSIONS.length - MASTER_MISSIONS.length}</span>
        </div>
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button className={`chip${outcome === "all" ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setOutcome("all")}>All outcomes</button>
          {OUTCOMES.map((o) => (
            <button key={o.id} className={`chip${outcome === o.id ? " active" : ""}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setOutcome(o.id)}>{o.short}</button>
          ))}
          <span style={{ width: 8 }} />
          <select className="input" style={{ minHeight: 0, padding: "3px 6px", fontSize: 11, width: "auto" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">All groups</option>
            {specialistCategories.map((c) => <option key={c.id} value={c.id}>{c.section}. {c.title}</option>)}
          </select>
          <input className="input" style={{ minHeight: 0, padding: "3px 8px", fontSize: 11, width: 240 }} placeholder="Search id or mission…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th>ID</th><th>Mission</th><th>Group</th><th>Outcome</th><th>AGI mode</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="clickable">
                  <td className="text-muted" style={{ whiteSpace: "nowrap" }}>{m.id}</td>
                  <td>
                    <Link href={`/missions/${m.id}`} style={{ fontWeight: 600 }}>{m.wow ?? m.title}</Link>
                    {m.wow && <span className="tag tag-accent" style={{ fontSize: 9, marginLeft: 6 }}>wow</span>}
                    {m.mvp && <span className="tag tag-ok" style={{ fontSize: 9, marginLeft: 6 }}>MVP</span>}
                  </td>
                  <td className="text-muted" style={{ fontSize: 11 }}>{CATEGORY_BY_ID[m.categoryId].title}</td>
                  <td><span className="tag tag-neutral" style={{ fontSize: 10 }}>{OUTCOME_BY_ID[m.outcome].short}</span></td>
                  <td><ModeTag mode={missionMode(m)} /></td>
                  <td style={{ textAlign: "right" }}>{m.appHref ? <Link href={m.appHref} className="btn btn-ghost" style={{ fontSize: 12 }}>Run</Link> : <span className="text-muted" style={{ fontSize: 11 }}>planned</span>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="text-muted">No missions match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* AGI mode legend */}
      <div className="grid-3">
        {(Object.keys(AGI_MODE_META) as AgiMode[]).map((mode) => {
          const Icon = MODE_ICON[mode];
          return (
            <div key={mode} className="panel">
              <div className="panel-head"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={14} color="var(--color-accent)" /><h5>{AGI_MODE_META[mode].label}</h5></div><span className="tag tag-neutral" style={{ fontSize: 10 }}>{MISSIONS.filter((m) => missionMode(m) === mode).length}</span></div>
              <div className="panel-body" style={{ fontSize: 12 }}>{AGI_MODE_META[mode].blurb}</div>
            </div>
          );
        })}
      </div>

      <div className="text-muted" style={{ fontSize: 12 }}>
        App Trainer is kept outside the core catalog, following the latest GMT24 direction. Open any mission for its governance card — group, versions, evidence, assigned agents, approver and the Draft → Reviewed → Approved → Filed → Locked status.
      </div>
    </div>
  );
}

function MasterCard({ m }: { m: Mission }) {
  const mode = missionMode(m);
  const outcome = OUTCOME_BY_ID[m.outcome];
  return (
    <Link href={`/missions/${m.id}`} className="panel" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div className="panel-head" style={{ gap: 8 }}>
        <div><div className="text-muted" style={{ fontSize: 10 }}>{m.id}</div><h5 style={{ marginTop: 2 }}>{m.title}</h5></div>
        {m.mvp && <span className="tag tag-ok" style={{ fontSize: 9 }}>MVP</span>}
      </div>
      <div className="panel-body" style={{ fontSize: 12, display: "grid", gap: 10 }}>
        <div className="text-muted">{m.output}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <ModeTag mode={mode} />
          <span className="tag tag-neutral" style={{ fontSize: 10 }}>{outcome.short}</span>
          {m.orchestrates && <span className="text-muted" style={{ fontSize: 10 }}>orchestrates {m.orchestrates.length}</span>}
        </div>
      </div>
    </Link>
  );
}
