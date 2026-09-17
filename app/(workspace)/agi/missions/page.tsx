"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Rocket, Target, User, Users, Workflow } from "lucide-react";
import { WORK_MODE_LABEL, type WorkMode } from "@/lib/agi/specialists";
import {
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
  type Mission,
  type OutcomeId,
} from "@/lib/agi/catalog";

const MODE_ICON: Record<WorkMode, typeof Users> = { single: User, team: Users, swarm: Workflow };

function ModeTag({ mode }: { mode: WorkMode }) {
  const Icon = MODE_ICON[mode];
  return (
    <span className="tag tag-outline" style={{ fontSize: 10, gap: 4 }} title={WORK_MODE_LABEL[mode].blurb}>
      <Icon size={11} />
      {WORK_MODE_LABEL[mode].label}
    </span>
  );
}

export default function MissionCatalog() {
  const [outcome, setOutcome] = useState<OutcomeId | "all">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [q, setQ] = useState("");

  const specialistCategories = CATEGORIES.filter((c) => !c.master);
  const specialistCount = MISSIONS.length - MASTER_MISSIONS.length;

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return MISSIONS.filter((m) => m.categoryId !== "master")
      .filter((m) => outcome === "all" || m.outcome === outcome)
      .filter((m) => categoryId === "all" || m.categoryId === categoryId)
      .filter((m) => !query || `${m.id} ${m.title} ${m.wow ?? ""}`.toLowerCase().includes(query));
  }, [outcome, categoryId, q]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Mission Catalog</h2>
        <Link href="/agi" className="btn btn-secondary"><Bot size={15} />Mission Control</Link>
        <Link href="/agi" className="btn btn-primary"><Rocket size={15} />New mission</Link>
      </div>

      <div className="kpi-grid cols-6">
        <div className="kpi"><div className="kpi-label">Missions</div><div className="kpi-val">{MISSIONS.length}</div><div className="kpi-sub">library total</div></div>
        <div className="kpi"><div className="kpi-label">Master</div><div className="kpi-val">{MASTER_MISSIONS.length}</div><div className="kpi-sub">outcome missions</div></div>
        <div className="kpi"><div className="kpi-label">Specialist</div><div className="kpi-val">{specialistCount}</div><div className="kpi-sub">orchestrated</div></div>
        <div className="kpi"><div className="kpi-label">Outcomes</div><div className="kpi-val">{OUTCOMES.length}</div><div className="kpi-sub">every mission maps to one</div></div>
        <div className="kpi"><div className="kpi-label">MVP set</div><div className="kpi-val">{MVP_MISSIONS.length}</div><div className="kpi-sub">strongest first release</div></div>
        <div className="kpi"><div className="kpi-label">Wow</div><div className="kpi-val">{WOW_MISSIONS.length}</div><div className="kpi-sub">headline differentiators</div></div>
      </div>

      <div className="callout" style={{ fontSize: 12 }}>
        The catalog is the library the Mission Director draws on, organised around four outcomes. You pick a <strong>Master Outcome Mission</strong>; the department orchestrates the specialist missions automatically as a Single agent, a Team or a Cooperative Swarm. The versioned engine posts every Pillar Two number. Every mission is stamped with its rulebook, jurisdiction-law and GIR-schema versions.
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <span className="tag tag-outline" style={{ fontSize: 10 }}>{MISSION_GOVERNANCE.rulebook}</span>
          <span className="tag tag-outline" style={{ fontSize: 10 }}>{MISSION_GOVERNANCE.localLaw}</span>
          <span className="tag tag-outline" style={{ fontSize: 10 }}>{MISSION_GOVERNANCE.girSchema}</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h4>The four outcomes</h4><span className="tag tag-outline">what missions deliver</span></div>
        <div className="panel-body agi-two">
          {OUTCOMES.map((o) => (
            <Link key={o.id} href={o.area} className="callout" style={{ fontSize: 12, textDecoration: "none", color: "inherit", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Target size={14} color="var(--color-accent)" />
                <strong>{o.n}. {o.title}</strong>
                <span className="tag tag-accent" style={{ fontSize: 10, marginLeft: "auto" }}>{outcomeCount(o.id)}</span>
              </div>
              {o.blurb}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h4>Master Outcome Missions</h4><span className="tag tag-outline">what users see first</span></div>
        <div className="panel-body agi-two">
          {MASTER_MISSIONS.map((m) => <MasterCard key={m.id} m={m} />)}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h4>Recommended MVP launch set</h4><span className="tag tag-accent">{MVP_MISSIONS.length} missions</span></div>
        <div className="panel-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MVP_MISSIONS.map((m) => (
            <Link key={m.id} href={`/agi/missions/${m.id}`} className="chip" style={{ fontSize: 12 }} title={m.title}>
              <span className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{m.id}</span>&nbsp;{m.wow ?? m.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h4>Wow missions</h4><span className="tag tag-neutral">{WOW_MISSIONS.length}</span></div>
        <div className="panel-body" style={{ fontSize: 12, overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>Mission</th><th>Group</th><th>Outcome</th><th>AGI mode</th><th /></tr></thead>
            <tbody>
              {WOW_MISSIONS.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.wow}</strong><div className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{m.id}</div></td>
                  <td>{CATEGORY_BY_ID[m.categoryId].title}</td>
                  <td>{OUTCOME_BY_ID[m.outcome].short}</td>
                  <td><ModeTag mode={missionMode(m)} /></td>
                  <td style={{ textAlign: "right" }}><Link href={`/agi/missions/${m.id}`} className="btn btn-ghost" style={{ fontSize: 12 }}>Open<ArrowRight size={13} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 8 }}>
          <h4>Specialist mission catalog</h4>
          <span className="tag tag-outline">{rows.length} of {specialistCount}</span>
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
        <div className="panel-body" style={{ paddingTop: 0, fontSize: 12, overflowX: "auto" }}>
          <table className="table">
            <thead><tr><th>ID</th><th>Mission</th><th>Group</th><th>Outcome</th><th>AGI mode</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="agi-mono" style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{m.id}</td>
                  <td>
                    <Link href={`/agi/missions/${m.id}`} style={{ fontWeight: 600 }}>{m.wow ?? m.title}</Link>
                    {m.wow && <span className="tag tag-accent" style={{ fontSize: 9, marginLeft: 6 }}>wow</span>}
                    {m.mvp && <span className="tag tag-ok" style={{ fontSize: 9, marginLeft: 6 }}>MVP</span>}
                  </td>
                  <td style={{ color: "var(--color-neutral-600)" }}>{CATEGORY_BY_ID[m.categoryId].title}</td>
                  <td><span className="tag tag-neutral" style={{ fontSize: 10 }}>{OUTCOME_BY_ID[m.outcome].short}</span></td>
                  <td><ModeTag mode={missionMode(m)} /></td>
                  <td style={{ textAlign: "right" }}>{m.appHref ? <Link href={m.appHref} className="btn btn-ghost" style={{ fontSize: 12 }}>Run</Link> : <span style={{ color: "var(--color-neutral-600)" }}>planned</span>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} style={{ color: "var(--color-neutral-600)" }}>No missions match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
        App Trainer is kept outside the core catalog, following the latest GMT24 direction. Open any mission for its governance card — group, versions, evidence, assigned agents, approver and the Draft → Reviewed → Approved → Filed → Locked status.
      </div>
    </div>
  );
}

function MasterCard({ m }: { m: Mission }) {
  const mode = missionMode(m);
  const outcome = OUTCOME_BY_ID[m.outcome];
  return (
    <Link href={`/agi/missions/${m.id}`} className="callout" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="agi-mono" style={{ color: "var(--color-neutral-600)" }}>{m.id}</span>
        <strong style={{ flex: 1 }}>{m.title}</strong>
        {m.mvp && <span className="tag tag-ok" style={{ fontSize: 9 }}>MVP</span>}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)", margin: "6px 0" }}>{m.output}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <ModeTag mode={mode} />
        <span className="tag tag-neutral" style={{ fontSize: 10 }}>{outcome.short}</span>
        {m.orchestrates && <span style={{ fontSize: 10, color: "var(--color-neutral-600)" }}>orchestrates {m.orchestrates.length}</span>}
      </div>
    </Link>
  );
}
