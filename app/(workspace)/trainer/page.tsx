"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { useAi } from "@/components/AiProvider";
import { Actions } from "@/components/ai/ReplyView";
import { ERRORS, nextStep, ONBOARDING } from "@/lib/ai/trainer";
import { SCREENS } from "@/lib/ai/context";
import { ROLE_LABEL, type UserRole } from "@/lib/ai/types";

export default function TrainerPage() {
  const ai = useAi();
  const { setCopilotOpen } = useStore();
  const steps = nextStep(ai.ctx);
  const path = ONBOARDING[ai.ctx.role];
  const ask = (q: string) => { setCopilotOpen(true); void ai.ask(q, { feature: "trainer" }); };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="callout" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <strong>Learn GMT24 while doing the work.</strong>
          <div className="text-muted" style={{ marginTop: 4 }}>Three modes on every screen: explain it, show me the path, help me complete it. Guidance follows your role, your screen and what is still outstanding.</div>
        </div>
        <Link href="/playbook/copilot" className="btn btn-secondary">Playbook</Link>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>Role
          <select className="input" style={{ minHeight: 0, padding: "4px 8px", width: "auto" }} value={ai.ctx.role} onChange={(e) => ai.setRole(e.target.value as UserRole)}>{(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </label>
      </div>

      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>Your next steps</h5><span className="text-muted" style={{ fontSize: 11 }}>{ai.ctx.groupName} · {ai.ctx.fy}</span></div>
          <div className="panel-body" style={{ display: "grid", gap: 12 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ borderLeft: "3px solid var(--color-accent)", paddingLeft: 12 }}>
                <div style={{ fontWeight: 700 }}>{i + 1}. {s.title}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{s.why}</div>
                <div className="stack-actions" style={{ marginTop: 6 }}>
                  <Link href={s.href} className="btn btn-secondary" style={{ fontSize: 12 }}>Show me</Link>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => ask(`Explain: ${s.title}`)}>Explain it</button>
                  {s.action && <Actions actions={[s.action]} />}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h5>{path.title}</h5><span className="tag tag-neutral">{path.steps.length} steps</span></div>
          <div className="panel-body">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {path.steps.map((s, i) => <li key={i} style={{ marginBottom: 8 }}><Link href={s.href} style={{ fontWeight: 700 }}>{s.target}</Link><div className="text-muted" style={{ fontSize: 12 }}>{s.text}</div></li>)}
            </ol>
          </div>
        </div>
      </div>

      <div className="grid-split">
        <div className="panel">
          <div className="panel-head"><h5>Screen registry</h5><span className="text-muted" style={{ fontSize: 11 }}>what each screen is for · fields · actions</span></div>
          <div className="table-wrap"><table className="table" style={{ fontSize: 12 }}><thead><tr><th>Module</th><th>Screen</th><th>Purpose</th><th>Ask</th></tr></thead><tbody>
            {SCREENS.map((s) => <tr key={s.key}><td className="text-muted">{s.module}</td><td><Link href={s.href}>{s.title}</Link></td><td>{s.purpose}</td><td><button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => ask(`What does the ${s.title} screen do and what should I do there?`)}>Explain</button></td></tr>)}
          </tbody></table></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h5>Error diagnosis</h5><span className="text-muted" style={{ fontSize: 11 }}>messages the product can emit, with corrective steps</span></div>
          <div className="panel-body" style={{ display: "grid", gap: 10, fontSize: 13 }}>
            {ERRORS.map((e) => <div key={e.title}><strong>{e.title}</strong><div className="text-muted" style={{ fontSize: 12 }}>{e.cause}</div><ol style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>{e.fix.map((f, i) => <li key={i}>{f}</li>)}</ol><Link href={e.href} style={{ fontSize: 12 }}>Go to the screen</Link></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
