"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModeToggle } from "@/components/ModeToggle";
import { useStore } from "@/lib/store";
import { ADVISOR_USER, INHOUSE_USER } from "@/lib/model";

export default function SettingsPage() {
  const { mode, setMode, flash, activeFy, yearLocked, groupId, historyImmutable, setHistoryImmutable, historyChainOk, historyEvents } = useStore();
  const router = useRouter();
  const user = mode === "advisor" ? ADVISOR_USER : INHOUSE_USER;
  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-head"><h4>Operating mode</h4></div>
        <div className="panel-body">
          <div className="seg" style={{ width: "100%", marginBottom: 14 }}>
            <label className="seg-opt" style={{ flex: 1 }}>
              <input type="radio" name="mode" checked={mode === "inhouse"} onChange={() => { setMode("inhouse"); flash("In-house mode"); router.push("/overview"); }} />
              In-house
            </label>
            <label className="seg-opt" style={{ flex: 1 }}>
              <input type="radio" name="mode" checked={mode === "advisor"} onChange={() => { setMode("advisor"); flash("Advisor mode"); router.push("/clients"); }} />
              Advisor
            </label>
          </div>
          <p className="text-muted" style={{ fontSize: 13 }}>
            In-house: single MNE, internal data requests, Group Tax Director as reviewer, one year ledger.<br />
            Advisor: multi-client portfolio, New engagement, client PBC, partner sign-off, one year ledger per client.
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Appearance</h4></div>
        <div className="panel-body"><ModeToggle /></div>
      </div>
      <div className="panel">
        <div className="panel-head"><h4>Session</h4></div>
        <div className="panel-body">
          <div className="wf-row"><span>User</span><span>{user.name}</span></div>
          <div className="wf-row"><span>Role</span><span>{user.role}</span></div>
          <div className="wf-row"><span>Org</span><span>{user.org}</span></div>
          <div className="wf-row"><span>Controls</span><span>SSO · MFA · entity ACL{historyImmutable ? " · immutable evidence history" : " · evidence history writable"}</span></div>
          <div className="wf-row"><span>Active Fiscal Year</span><span>{activeFy} · {yearLocked ? "lock on file" : "working"}</span></div>
          <div className="wf-row"><span>Year ledger</span><span>{mode === "advisor" ? `Per client · ${groupId}` : `In-house · ${groupId}`}</span></div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h4>Evidence history</h4>
          <span className={historyImmutable ? "tag tag-accent" : "tag tag-outline"}>{historyImmutable ? "Immutable" : "Writable"}</span>
        </div>
        <div className="panel-body">
          <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
            Documents, mapping/election changes, engine snapshots, user actions and comments sit on one hash chain. Immutability on = sealed (append-only). Off = delete or reset a working log. Open <Link href="/evidence-history">Evidence history</Link>.
          </p>
          <div className="seg" style={{ width: "100%", marginBottom: 12 }}>
            <label className="seg-opt" style={{ flex: 1 }}>
              <input type="radio" name="set-eh" checked={historyImmutable} onChange={() => { setHistoryImmutable(true); flash("Evidence history sealed"); }} />
              Immutable on
            </label>
            <label className="seg-opt" style={{ flex: 1 }}>
              <input type="radio" name="set-eh" checked={!historyImmutable} onChange={() => { setHistoryImmutable(false); flash("Evidence history writable"); }} />
              Immutable off
            </label>
          </div>
          <div className="wf-row"><span>Entries</span><span>{historyEvents.length}</span></div>
          <div className="wf-row"><span>Chain</span><span>{historyChainOk ? "Intact" : "Broken"}</span></div>
        </div>
      </div>
    </div>
  );
}
