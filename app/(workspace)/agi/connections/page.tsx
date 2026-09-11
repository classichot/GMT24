"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, ExternalLink, KeyRound, Plug, RefreshCw, X } from "lucide-react";
import { TOOL_CATALOGUE } from "@/lib/agi/tools";
import { useAgi } from "@/lib/agi/useAgi";
import { AGENT_CLIENTS, ALL_AGENT_SCOPES, MISSION_STATE_LABEL, type ActivityEvent, type AgentScope } from "@/lib/agi/types";

type Recipes = {
  gateway: string; mcp: string; plugin: string;
  scopes: { id: AgentScope; label: string }[];
  instructions: string;
  clients: { id: string; recipe: string[] }[];
};
type TestResult = { ok: boolean; client: string; steps: { id: string; label: string; ok: boolean; detail: string }[]; checklist: { label: string; step: string; ok: boolean }[] };

export default function ConnectionsPage() {
  const agi = useAgi();
  const [recipes, setRecipes] = useState<Recipes | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([
        fetch(`/api/agi/connections?groupId=${encodeURIComponent(agi.groupId)}`, { headers: agi.headers() }),
        fetch(`/api/agi/activity?groupId=${encodeURIComponent(agi.groupId)}&limit=60`, { headers: agi.headers() }),
      ]);
      if (r.ok) setRecipes((await r.json()) as Recipes);
      if (a.ok) setActivity(((await a.json()) as { events: ActivityEvent[] }).events ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [agi]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Agent Connections</h2>
        <button className="btn btn-ghost" onClick={() => void load()}><RefreshCw size={14} />Refresh</button>
      </div>

      <div className="callout">
        <strong>Connecting an external assistant is not the same as selecting a model.</strong> Grok Bot, Claude Cowork and GPT Work are the three clients that can drive a GMT24 mission from outside; each connects to the same Agent Gateway and uses the same eleven tools, so a mission started in one can be continued in another under the same mission id. Model choice for GMT24's own Co-Pilot lives in <Link href="/settings">Settings</Link> and is unrelated. Keys are scoped to this group; approval scopes do not exist — agents prepare, people approve in GMT24.
      </div>
      {err && <div className="callout" style={{ borderLeftColor: "var(--color-hot)" }}>Gateway unreachable: {err}</div>}

      {recipes && (
        <section className="panel">
          <div className="panel-head"><h4>Shared gateway</h4><span className="tag tag-outline">one toolset · three clients</span></div>
          <div className="panel-body agi-two" style={{ fontSize: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <Row k="REST gateway" v={recipes.gateway} />
              <Row k="MCP endpoint (JSON-RPC)" v={recipes.mcp} />
              <Row k="Plugin manifest (GPT Work)" v={recipes.plugin} link />
              <Row k="Auth" v="Authorization: Bearer <gateway key> · keys signed with GMT24_AGENT_SECRET · rotate epoch to revoke all" />
              <Row k="Idempotency" v="Same tool + inputs + case version → same job id; results are retrievable by GET /api/agi/jobs/{id}" />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 6 }}>Tool catalogue</div>
              <table className="table">
                <thead><tr><th>Tool</th><th>Scope</th><th>Runs</th></tr></thead>
                <tbody>{TOOL_CATALOGUE.map((t) => <tr key={t.name}><td><span className="agi-mono">{t.name}</span><div style={{ color: "var(--color-neutral-600)" }}>{t.title}</div></td><td className="agi-mono">{t.scope}</td><td>{t.longRunning ? "job" : "immediate"}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <div className="agi-client-grid">
        {Object.values(AGENT_CLIENTS).map((c) => (
          <ClientCard key={c.id} id={c.id} recipes={recipes} />
        ))}
      </div>

      {recipes && (
        <section className="panel">
          <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10 }}><h4 style={{ flex: 1 }}>Mission instructions (same text for every client)</h4><CopyBtn text={recipes.instructions} /></div>
          <div className="panel-body"><pre className="agi-pre">{recipes.instructions}</pre></div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h4>Missions and ownership</h4><span className="tag tag-outline">{agi.missions.length}</span></div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          {agi.missions.length === 0 ? <div>No missions in this group yet.</div> : (
            <table className="table">
              <thead><tr><th>Mission</th><th>State</th><th>Owner</th><th>Lease</th><th>Handoffs</th><th>Created by</th></tr></thead>
              <tbody>{agi.missions.map((m) => <tr key={m.id}><td className="agi-mono"><Link href="/agi" onClick={() => agi.select(m.id)}>{m.id}</Link></td><td>{MISSION_STATE_LABEL[m.state]}</td><td>{m.owner.client} · {m.owner.actor}</td><td>{new Date(m.owner.leaseUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td><td>{m.handoffs.length}</td><td>{m.createdBy}</td></tr>)}</tbody>
            </table>
          )}
          <div style={{ marginTop: 8, color: "var(--color-neutral-600)" }}>Ownership is a 30-minute lease renewed on every call. A person hands a mission to another agent from Mission Overview; an agent cannot take an owned mission while the lease is live.</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h4>Gateway activity</h4><span className="tag tag-outline">{activity.length}</span></div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          {activity.length === 0 ? <div>No gateway activity recorded for this group yet.</div> : (
            <table className="table">
              <thead><tr><th>When</th><th>Client</th><th>Actor</th><th>Action</th><th>Mission</th><th>Result</th><th>Detail</th></tr></thead>
              <tbody>{activity.map((e) => <tr key={e.id}><td style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-GB")}</td><td>{e.client}</td><td>{e.actor}</td><td className="agi-mono">{e.tool ?? e.action}</td><td className="agi-mono">{e.missionId ?? "—"}</td><td>{e.ok ? <span className="tag tag-ok" style={{ fontSize: 10 }}>ok</span> : <span className="tag tag-hot" style={{ fontSize: 10 }}>failed</span>}</td><td>{e.detail}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, link }: { k: string; v: string; link?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>
      <span style={{ color: "var(--color-neutral-600)" }}>{k}</span>
      <span className="agi-mono" style={{ wordBreak: "break-all" }}>{link ? <a href={v} target="_blank" rel="noreferrer">{v} <ExternalLink size={10} /></a> : v}</span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}>
      {done ? <Check size={13} /> : <Copy size={13} />}{done ? "Copied" : "Copy"}
    </button>
  );
}

function ClientCard({ id, recipes }: { id: keyof typeof AGENT_CLIENTS; recipes: Recipes | null }) {
  const agi = useAgi();
  const c = AGENT_CLIENTS[id];
  const recipe = recipes?.clients.find((x) => x.id === id)?.recipe ?? [];
  const [scopes, setScopes] = useState<AgentScope[]>([...ALL_AGENT_SCOPES]);
  const [days, setDays] = useState(30);
  const [label, setLabel] = useState(`${c.name} · ${agi.actor}`);
  const [pin, setPin] = useState("");
  const [minted, setMinted] = useState<{ key: string; exp: number } | null>(null);
  const [testKey, setTestKey] = useState("");
  const [test, setTest] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mint = async () => {
    setBusy("mint"); setErr(null);
    try {
      const r = await fetch("/api/agi/connections", { method: "POST", headers: { ...agi.headers(), ...(pin ? { "x-gmt24-admin-pin": pin } : {}) }, body: JSON.stringify({ client: id, groupId: agi.groupId, scopes, days, label }) });
      const j = (await r.json()) as { key?: string; grant?: { exp: number }; error?: string; detail?: string };
      if (!r.ok || !j.key) throw new Error(j.detail ?? j.error ?? `HTTP ${r.status}`);
      setMinted({ key: j.key, exp: j.grant?.exp ?? 0 });
      setTestKey(j.key);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const runTest = async () => {
    setBusy("test"); setErr(null); setTest(null);
    try {
      const r = await fetch("/api/agi/connections/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: testKey }) });
      const j = (await r.json()) as TestResult & { error?: string; detail?: string };
      if (!r.ok) throw new Error(j.detail ?? j.error ?? `HTTP ${r.status}`);
      setTest(j);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Bot size={16} />
        <div style={{ flex: 1 }}><h4>{c.name}</h4><div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{c.vendor} · {c.transport === "plugin" ? "plugin with MCP" : "remote MCP"}</div></div>
        <a href={c.docs} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 11 }}>Docs <ExternalLink size={11} /></a>
      </div>
      <div className="panel-body" style={{ fontSize: 12, display: "grid", gap: 12 }}>
        <div><strong>Integration</strong><div style={{ color: "var(--color-neutral-600)" }}>{c.integration}</div></div>
        {recipe.length > 0 && <div><strong>Connect</strong><ol style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>{recipe.map((s) => <li key={s}>{s}</li>)}</ol></div>}
        <div>
          <strong><KeyRound size={12} style={{ verticalAlign: -2 }} /> Issue a gateway key</strong>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {ALL_AGENT_SCOPES.map((s) => (
              <label key={s} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))} />
                <span className="agi-mono">{s}</span><span style={{ color: "var(--color-neutral-600)" }}>{recipes?.scopes.find((x) => x.id === s)?.label}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 140 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Key label" />
            <input className="input" style={{ width: 80 }} type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} title="Days valid (1–90)" />
            <input className="input" style={{ width: 110 }} type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Admin PIN" title="Only if this deployment sets GMT24_AGENT_ADMIN_PIN" />
            <button className="btn btn-primary" disabled={busy !== null || !scopes.length} onClick={mint}><KeyRound size={13} />Issue key</button>
          </div>
          {minted && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="tag tag-ok">Key issued · until {new Date(minted.exp).toLocaleDateString("en-GB")}</span><CopyBtn text={minted.key} /></div>
              <pre className="agi-pre" style={{ marginTop: 6 }}>{minted.key}</pre>
              <div style={{ color: "var(--color-neutral-600)", marginTop: 4 }}>Shown once. Paste it as <span className="agi-mono">Authorization: Bearer …</span> in {c.name}.</div>
            </div>
          )}
        </div>
        <div>
          <strong><Plug size={12} style={{ verticalAlign: -2 }} /> Test connection</strong>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input className="input" style={{ flex: 1 }} value={testKey} onChange={(e) => setTestKey(e.target.value)} placeholder="gmt24_agi.…" />
            <button className="btn btn-secondary" disabled={busy !== null || testKey.length < 10} onClick={runTest}>{busy === "test" ? <RefreshCw size={13} className="spin" /> : <Plug size={13} />}Test</button>
          </div>
          <div style={{ marginTop: 6, color: "var(--color-neutral-600)" }}>Verifies: {c.verify.join(" · ")}.</div>
          {test && (
            <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
              <div><span className={`tag ${test.ok ? "tag-ok" : "tag-hot"}`}>{test.ok ? "All checks passed" : "Some checks failed"}</span></div>
              {test.checklist.map((x) => (
                <div key={x.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  {x.ok ? <Check size={13} color="var(--color-ok)" style={{ flex: "none", marginTop: 2 }} /> : <X size={13} color="var(--color-hot)" style={{ flex: "none", marginTop: 2 }} />}
                  <div><strong>{x.label}</strong><div style={{ color: "var(--color-neutral-600)" }}>{test.steps.find((s) => s.id === x.step)?.detail}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {err && <div className="callout" style={{ borderLeftColor: "var(--color-hot)" }}>{err}</div>}
      </div>
    </section>
  );
}
