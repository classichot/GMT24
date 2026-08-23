"use client";

import { useRouter } from "next/navigation";
import { ModeToggle } from "@/components/ModeToggle";
import { useStore } from "@/lib/store";
import { ADVISOR_USER, INHOUSE_USER } from "@/lib/model";

export default function SettingsPage() {
  const { mode, setMode, flash, activeFy, yearLocked } = useStore();
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
            In-house: single MNE, internal data requests, Group Tax Director as reviewer.<br />
            Advisor: multi-client portfolio, engagement letters, client PBC, partner sign-off.
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
          <div className="wf-row"><span>Controls</span><span>SSO · MFA · entity ACL · immutable logs (prototype flags)</span></div>
          <div className="wf-row"><span>Active Fiscal Year</span><span>{activeFy} · {yearLocked ? "locked final" : "working"}</span></div>
        </div>
      </div>
    </div>
  );
}
