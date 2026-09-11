"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { AgiToggle } from "@/components/AgiToggle";
import { useAgi } from "@/lib/agi/useAgi";
import { MISSION_STATE_LABEL, type MissionRecord } from "@/lib/agi/types";
import { stateTag } from "@/lib/agi/mission";
import { shortHash } from "@/lib/agi/case";
import type { ReactNode } from "react";

export const AGI_AREAS = [
  { href: "/agi", label: "Mission Overview" },
  { href: "/agi/options", label: "Options and Elections" },
  { href: "/agi/calculation", label: "Calculation Review" },
  { href: "/agi/compliance", label: "Compliance Review" },
  { href: "/agi/audit-file", label: "Audit File" },
  { href: "/agi/connections", label: "Agent Connections" },
];

export function StateBadge({ m, small }: { m: MissionRecord; small?: boolean }) {
  return <span className={`tag ${stateTag(m.state)}`} style={small ? { fontSize: 10 } : undefined}>{MISSION_STATE_LABEL[m.state]}</span>;
}

/** Band + area tabs + mission picker shared by every AGI screen. */
export function AgiFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const agi = useAgi();
  const m = agi.selected;
  return (
    <div>
      <div className="agi-band">
        <span className="agi-band-kicker"><Bot size={12} />AGI mode</span>
        <span className="agi-band-text">
          Mission-execution layer above normal mode. Agents plan, compare, verify and assemble; GMT24 enforces who approves. Same engines, rule versions, permissions and evidence as normal mode — nothing here changes the case until a person applies an approved proposal.
        </span>
        <span className="tag tag-outline" title="Case version the workspace shows right now">Live case {shortHash(agi.liveHash)}</span>
        <span className={`tag ${agi.syncState === "offline" ? "tag-hot" : "tag-neutral"}`} title="Gateway mirror: external assistants continue the same mission id">
          {agi.syncState === "offline" ? <CloudOff size={11} /> : agi.syncState === "syncing" ? <RefreshCw size={11} className="spin" /> : <Cloud size={11} />}
          <span style={{ marginLeft: 4 }}>{agi.syncState === "offline" ? "Gateway offline" : agi.syncState === "syncing" ? "Syncing" : "Gateway mirrored"}</span>
        </span>
        <AgiToggle compact goto={false} />
      </div>
      <nav className="agi-tabs" aria-label="AGI areas">
        {AGI_AREAS.map((a, i) => (
          <Link key={a.href} href={a.href} className={(a.href === "/agi" ? path === "/agi" : path.startsWith(a.href)) ? "active" : ""}>
            <span className="agi-tab-n">{i + 1}</span>{a.label}
          </Link>
        ))}
      </nav>
      {path !== "/agi/connections" && agi.missions.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Mission</label>
          <select className="input" style={{ maxWidth: 520 }} value={m?.id ?? ""} onChange={(e) => agi.select(e.target.value || null)}>
            {agi.missions.map((x) => (
              <option key={x.id} value={x.id}>{x.id} · v{x.version} · {MISSION_STATE_LABEL[x.state]} · {x.scope.jurisdictions.join(", ")}</option>
            ))}
          </select>
          {m && <StateBadge m={m} />}
          {m && <span className="tag tag-outline" title="Case version the mission is pinned to">Mission case {shortHash(m.case.hash)}</span>}
          {m && agi.drifted(m) && <Link href="/agi" className="tag tag-warn" style={{ textDecoration: "none" }}>Live case differs — recheck</Link>}
          {m && <span className="tag tag-neutral">Owner {m.owner.client}{m.owner.actor && m.owner.client === "workspace" ? ` · ${m.owner.actor}` : ""}</span>}
        </div>
      )}
      {agi.lastError && (
        <div className="callout" style={{ borderLeftColor: "var(--color-hot)", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{agi.lastError}</span>
          <button className="btn btn-ghost" onClick={agi.clearError}>Dismiss</button>
        </div>
      )}
      {children}
    </div>
  );
}

export function NoMission() {
  return (
    <div className="callout">
      No mission selected. Go to <Link href="/agi">Mission Overview</Link> to create the release-1 mission or select an existing one.
    </div>
  );
}
