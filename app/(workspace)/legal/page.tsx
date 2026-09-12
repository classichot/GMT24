"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DATA, RULES } from "@/lib/model";
import { ELECTIONS } from "@/lib/elections";
import { THAI_INSTRUMENTS } from "@/lib/thailand";
import {
  AUTHORITY_NAME,
  LEGAL_PASSAGES,
  LEGAL_SOURCES,
  TEXT_KIND_LABEL,
  citeLegal,
  fyStartDate,
  inForce,
  legalCoverage,
  passageById,
  passagesForSource,
  searchPassages,
  sourceOf,
  type LegalAuthority,
  type LegalPassage,
} from "@/lib/legal";
import { legalIntegrity } from "@/lib/legal/integrity";

type AuthorityFilter = "all" | "OECD" | "TH" | "other";

const AUTHORITY_CHIPS: { id: AuthorityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "OECD", label: "OECD" },
  { id: "TH", label: "Thailand" },
  { id: "other", label: "IE · JP · US" },
];

function authorityOk(p: LegalPassage, f: AuthorityFilter) {
  const a = sourceOf(p).authority;
  if (f === "all") return true;
  if (f === "other") return a !== "OECD" && a !== "TH";
  return a === f;
}

const AUTH_TAG: Record<LegalAuthority, string> = { OECD: "tag-accent", TH: "tag-neutral", IE: "tag-outline", JP: "tag-outline", US: "tag-outline" };

export default function LegalPage() {
  return (
    <Suspense fallback={<div className="callout">Loading legal corpus…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const pinned = (sp.get("p") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const ruleId = sp.get("rule");
  const electionId = sp.get("election");
  const instrumentId = sp.get("instrument");
  const sourceId = sp.get("source");
  const keyed = ruleId || electionId || instrumentId || sourceId;

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [authority, setAuthority] = useState<AuthorityFilter>((sp.get("authority") as AuthorityFilter) || "all");
  const [asOf, setAsOf] = useState(fyStartDate(DATA.group.fy));
  const [showOut, setShowOut] = useState(true);

  const coverage = useMemo(() => legalCoverage(), []);
  const integrity = useMemo(() => legalIntegrity(), []);

  const rule = ruleId ? RULES.find((r) => r.id === ruleId) : null;
  const election = electionId ? ELECTIONS.find((e) => e.id === electionId) : null;
  const instrument = instrumentId ? THAI_INSTRUMENTS.find((i) => i.id === instrumentId) : null;
  const source = sourceId ? LEGAL_SOURCES.find((s) => s.id === sourceId) : null;

  const hits = useMemo(() => {
    const trimmed = q.trim();
    let list: { passage: LegalPassage; score: number }[];
    if (pinned.length && !trimmed && !keyed) {
      list = pinned.map((id) => passageById(id)).filter((p): p is LegalPassage => Boolean(p)).map((passage) => ({ passage, score: 0 }));
    } else if (trimmed) {
      list = searchPassages(trimmed, { asOf, ruleId: ruleId ?? undefined, electionId: electionId ?? undefined, instrumentId: instrumentId ?? undefined, limit: 40 }).map((h) => ({ passage: h.passage, score: h.score }));
    } else if (sourceId) {
      list = passagesForSource(sourceId).map((passage) => ({ passage, score: 0 }));
    } else {
      list = LEGAL_PASSAGES.filter((p) => (!ruleId || p.ruleIds.includes(ruleId)) && (!electionId || p.electionIds.includes(electionId)) && (!instrumentId || p.instrumentIds.includes(instrumentId))).map((passage) => ({ passage, score: 0 }));
    }
    return list
      .filter(({ passage }) => authorityOk(passage, authority))
      .filter(({ passage }) => showOut || inForce(passage, asOf))
      .map((x) => ({ ...x, current: inForce(x.passage, asOf) }));
  }, [q, authority, asOf, showOut, pinned, ruleId, electionId, instrumentId, sourceId, keyed]);

  const browsing = !q.trim() && !keyed && !pinned.length;
  const shown = browsing ? hits.slice(0, 60) : hits;

  const clearKeys = () => { setQ(""); router.replace("/legal"); };

  return (
    <div>
      <div className="callout" style={{ marginBottom: 16 }}>
        <strong>Legal corpus.</strong> Passage-level text behind the <Link href="/rulebook">rule pack</Link>, the <Link href="/elections">election register</Link>, the <Link href="/thailand">Thai instrument list</Link> and the <Link href="/thailand/gap">OECD-vs-RD gap review</Link>. OECD and domestic law are separate authorities and every passage is effective-dated, so an answer can say “not in force for this year” instead of citing silently. The Co-Pilot, the AGI compliance review and the audit pack cite these same passage ids. Texts are GMT24 paraphrases or summaries — confirm wording against the linked source before relying on it.
      </div>

      <div className="kpi-grid cols-6" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Passages</div><div className="kpi-val" style={{ fontSize: 26 }}>{coverage.passages}</div><div className="kpi-sub">{coverage.paraphrase} paraphrase · {coverage.summary} summary · {coverage.pending} pending</div></div>
        <div className="kpi"><div className="kpi-label">Sources</div><div className="kpi-val" style={{ fontSize: 26 }}>{coverage.sources}</div><div className="kpi-sub">{LEGAL_SOURCES.filter((s) => s.status === "in-force").length} in force · {LEGAL_SOURCES.filter((s) => s.status === "superseded").length} superseded · {LEGAL_SOURCES.filter((s) => s.status === "pending").length} pending</div></div>
        <div className="kpi"><div className="kpi-label">OECD</div><div className="kpi-val" style={{ fontSize: 26 }}>{coverage.byAuthority.OECD.passages}</div><div className="kpi-sub">{coverage.byAuthority.OECD.sources} sources · Model Rules, Commentary, AG, safe harbours, GIR</div></div>
        <div className="kpi"><div className="kpi-label">Thailand</div><div className="kpi-val" style={{ fontSize: 26 }}>{coverage.byAuthority.TH.passages}</div><div className="kpi-sub">{coverage.byAuthority.TH.sources} sources · decree, DG and MOF notifications, BOI</div></div>
        <div className="kpi"><div className="kpi-label">Keyed to</div><div className="kpi-val" style={{ fontSize: 26 }}>{coverage.ruleIds.length}</div><div className="kpi-sub">rules · {coverage.electionIds.length} elections · {coverage.instrumentIds.length} instruments · {coverage.gapIds.length} gaps</div></div>
        <div className="kpi"><div className="kpi-label">Integrity</div><div className="kpi-val" style={{ fontSize: 26 }}>{integrity.ok ? "OK" : "Check"}</div><div className={`kpi-sub${integrity.ok ? "" : " hot"}`}>{integrity.ok ? "every id resolves; no rule without a passage" : [...integrity.unknownRules, ...integrity.unknownElections, ...integrity.unknownInstruments, ...integrity.unknownGaps, ...integrity.unknownSources, ...integrity.rulesWithoutPassages].slice(0, 4).join(", ")}</div></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <input
            className="input"
            style={{ flex: "1 1 320px", minWidth: 220 }}
            placeholder="Search the corpus — e.g. Art. 4.4.4 recapture, SBIE transitional rates, Thai filing deadline, s 57"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search legal corpus"
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AUTHORITY_CHIPS.map((c) => (
              <button key={c.id} type="button" className={`chip${authority === c.id ? " active" : ""}`} onClick={() => setAuthority(c.id)}>{c.label}</button>
            ))}
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span className="text-muted">As of</span>
            <input className="input" type="date" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} style={{ width: 160 }} aria-label="As-of date" />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={showOut} onChange={(e) => setShowOut(e.target.checked)} /> show passages not in force
          </label>
        </div>
        {(keyed || pinned.length > 0) && (
          <div className="panel-body" style={{ borderTop: "1px solid var(--color-divider)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
            <span className="text-muted">Filtered by</span>
            {rule && <span className="tag tag-accent">rule {rule.id} · {rule.source}</span>}
            {ruleId && !rule && <span className="tag tag-warn">unknown rule {ruleId}</span>}
            {election && <span className="tag tag-accent">election {election.id} · {election.name} ({election.article})</span>}
            {electionId && !election && <span className="tag tag-warn">unknown election {electionId}</span>}
            {instrument && <span className="tag tag-accent">instrument {instrument.id} · {instrument.cite}</span>}
            {instrumentId && !instrument && <span className="tag tag-warn">unknown instrument {instrumentId}</span>}
            {source && <span className="tag tag-accent">source {source.short}</span>}
            {pinned.length > 0 && <span className="tag tag-neutral">{pinned.length} pinned passage{pinned.length === 1 ? "" : "s"}</span>}
            <button type="button" className="btn btn-ghost" onClick={clearKeys}>Clear</button>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h4>{browsing ? "Browse" : q.trim() ? "Search results" : pinned.length && !keyed ? "Cited passages" : "Passages"}</h4>
          <span className="tag tag-outline">{shown.length}{browsing && hits.length > shown.length ? ` of ${hits.length}` : ""}</span>
        </div>
        {!shown.length && (
          <div className="panel-body text-muted">
            No passage matched. Try an article number (“Art. 5.3”), a Thai section (“s 54”), a notification (“Notification No. 4”) or a topic word such as “recapture”, “safe harbour” or “imputation”.
          </div>
        )}
        {shown.map(({ passage: p, current, score }) => <PassageCard key={p.id} p={p} current={current} asOf={asOf} score={score} />)}
        {browsing && hits.length > shown.length && <div className="panel-body text-muted" style={{ fontSize: 13 }}>Showing the first {shown.length} of {hits.length}. Search, or filter by authority, rule, election or instrument to narrow.</div>}
      </div>

      <div className="panel">
        <div className="panel-head"><h4>Sources</h4><span className="tag tag-outline">{LEGAL_SOURCES.length}</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Source</th><th>Authority</th><th>Kind</th><th>Published</th><th>Effective</th><th>Status</th><th>Passages</th><th>Link</th></tr></thead>
            <tbody>
              {LEGAL_SOURCES.filter((s) => authority === "all" || (authority === "other" ? s.authority !== "OECD" && s.authority !== "TH" : s.authority === authority)).map((s) => {
                const n = passagesForSource(s.id).length;
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.short}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>{s.title}{s.version ? ` · ${s.version}` : ""}</div>
                      {s.note && <div className="text-muted" style={{ fontSize: 12 }}>{s.note}</div>}
                    </td>
                    <td><span className={`tag ${AUTH_TAG[s.authority]}`} style={{ fontSize: 10 }}>{s.authority}</span></td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{s.kind}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{s.publishedAt}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{s.effectiveFrom ?? "—"}{s.effectiveTo ? ` → ${s.effectiveTo}` : ""}</td>
                    <td><span className={`tag ${s.status === "in-force" ? "tag-ok" : s.status === "superseded" ? "tag-warn" : "tag-neutral"}`} style={{ fontSize: 10 }}>{s.status}</span></td>
                    <td>{n ? <Link href={`/legal?source=${encodeURIComponent(s.id)}`} className="mono">{n}</Link> : <span className="text-muted">0</span>}</td>
                    <td><a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>open</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PassageCard({ p, current, asOf, score }: { p: LegalPassage; current: boolean; asOf: string; score: number }) {
  const s = sourceOf(p);
  const cite = citeLegal(p);
  const why = !current ? (s.status === "superseded" ? `superseded${s.effectiveTo ? ` on ${s.effectiveTo}` : ""}` : p.textKind === "pending" ? "instrument not yet issued" : p.effectiveFrom > asOf ? `in force from ${p.effectiveFrom}` : p.effectiveTo ? `ceased ${p.effectiveTo}` : "not in force") : null;
  const elections = p.electionIds.map((id) => ELECTIONS.find((e) => e.id === id)).filter(Boolean);
  const instruments = p.instrumentIds.map((id) => THAI_INSTRUMENTS.find((i) => i.id === id)).filter(Boolean);
  return (
    <div id={p.id} className="panel-body" style={{ borderTop: "1px solid var(--color-divider)", opacity: current ? 1 : 0.78 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <span className={`tag ${AUTH_TAG[s.authority]}`} style={{ fontSize: 10 }}>{s.authority}</span>
        <Link href={cite.href} className="mono" style={{ fontWeight: 700 }}>{cite.label}</Link>
        {p.jurisdiction !== "*" && <span className="tag tag-neutral" style={{ fontSize: 10 }}>{p.jurisdiction}</span>}
        {current ? <span className="tag tag-ok" style={{ fontSize: 10 }}>in force {asOf}</span> : <span className="tag tag-warn" style={{ fontSize: 10 }}>{why}</span>}
        <span className="tag tag-outline" style={{ fontSize: 10 }}>{p.textKind}</span>
        {score > 0 && <span className="text-muted mono" style={{ fontSize: 11 }}>score {score}</span>}
        <span className="text-muted mono" style={{ fontSize: 11, marginLeft: "auto" }}>{p.id}</span>
      </div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.heading}</div>
      <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.55 }}>{p.text}</p>
      {p.note && <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>Note: {p.note}</div>}
      <div className="text-muted" style={{ fontSize: 12, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
        <span>{TEXT_KIND_LABEL[p.textKind]}</span>
        <span>Effective {p.effectiveFrom}{p.effectiveTo ? ` → ${p.effectiveTo}` : ""}</span>
        <span>{AUTHORITY_NAME[s.authority]}{s.version ? ` · ${s.version}` : ""}</span>
        <a href={p.href ?? s.url} target="_blank" rel="noreferrer">source</a>
      </div>
      {(p.ruleIds.length > 0 || elections.length > 0 || instruments.length > 0 || p.gapIds.length > 0 || p.topics.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {p.ruleIds.map((id) => <Link key={id} href={`/legal?rule=${encodeURIComponent(id)}`} className="tag tag-accent" style={{ fontSize: 10 }} title="rule">{id}</Link>)}
          {elections.map((e) => <Link key={e!.id} href={`/legal?election=${encodeURIComponent(e!.id)}`} className="tag tag-neutral" style={{ fontSize: 10 }} title={e!.name}>election {e!.id}</Link>)}
          {instruments.map((i) => <Link key={i!.id} href={`/legal?instrument=${encodeURIComponent(i!.id)}`} className="tag tag-neutral" style={{ fontSize: 10 }} title={i!.cite}>{i!.cite}</Link>)}
          {p.gapIds.map((id) => <Link key={id} href="/thailand/gap" className="tag tag-warn" style={{ fontSize: 10 }} title="OECD-vs-RD gap item">{id}</Link>)}
          {p.topics.slice(0, 6).map((t) => <span key={t} className="tag tag-outline" style={{ fontSize: 10 }}>{t}</span>)}
        </div>
      )}
    </div>
  );
}
