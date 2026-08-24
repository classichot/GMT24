"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JURISDICTION_PACKS } from "@/lib/model";
import { EMPTY_DRAFT, ONBOARD_STEPS, PACK_DOCS, type EngagementDraft } from "@/lib/onboard";
import { useStore } from "@/lib/store";
import { StartEngage } from "@/components/StartEngage";

export default function OnboardPage() {
  const { addEngagement, mode, group, setMode, flash } = useStore();
  const router = useRouter();
  const [draft, setDraft] = useState<EngagementDraft>(EMPTY_DRAFT);
  const [err, setErr] = useState("");
  const justAdded = Boolean(group.custom);

  function set<K extends keyof EngagementDraft>(k: K, v: EngagementDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
    setErr("");
  }

  function submit() {
    if (!draft.name.trim()) {
      setErr("Group legal name is required.");
      return;
    }
    if (!draft.upe.trim()) {
      setErr("UPE legal name is required.");
      return;
    }
    const id = addEngagement(draft);
    if (!id) {
      setErr("Could not open the engagement — that group may already be on the portfolio.");
      return;
    }
    setDraft(EMPTY_DRAFT);
    router.push("/data");
  }

  if (mode !== "advisor") {
    return (
      <div>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          New engagement is an Advisor-mode action. In-house stays on a single MNE ledger.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setMode("advisor"); flash("Advisor mode"); }}
        >
          Switch to Advisor
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-start" }}>
        <p className="text-muted" style={{ margin: 0, flex: 1, maxWidth: "72ch" }}>
          Open a client file. Capture identity and the €750m window, then drop the close pack. The engine does not calculate from this form — it waits for mapped source data.
        </p>
        <div className="stack-actions">
          <Link href="/clients" className="btn btn-secondary">Portfolio</Link>
          <StartEngage kind="create" onClick={submit} />
        </div>
      </div>

      {justAdded && (
        <div className="callout" style={{ marginBottom: 16, fontSize: 13 }}>
          <strong>{group.name}</strong> is open{group.upeTin ? ` · UPE ID ${group.upeTin}` : ""}. Drop the close pack next. Live numbers still use the Aetherion teaching snapshot until this pack is posted.{" "}
          <Link href="/data">Go to Data Hub →</Link>
        </div>
      )}

      <h5 className="sec-h" style={{ marginTop: 8 }}>The whole process</h5>
      <div className="onboard-map">
        {ONBOARD_STEPS.map((s) => (
          <Link key={s.id} href={s.href} className={`onboard-step${s.href === "/onboard" ? " on" : ""}`}>
            <div className="onboard-n">{s.n}</div>
            <div className="onboard-title">{s.title}</div>
            <div className="onboard-do">{s.do}</div>
          </Link>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 8 }}>
        <section>
          <h5 className="sec-h">1–2 · Open the file</h5>
          {err && <div className="callout" style={{ marginBottom: 12, fontSize: 13 }}>{err}</div>}
          <div className="form-grid">
            <label className="field">
              <span>MNE / group legal name</span>
              <input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Example Manufacturing Group" />
            </label>
            <label className="field">
              <span>Ultimate Parent Entity</span>
              <input className="input" value={draft.upe} onChange={(e) => set("upe", e.target.value)} placeholder="Example Holdings Pte. Ltd." />
            </label>
            <label className="field">
              <span>UPE jurisdiction</span>
              <select className="input" value={draft.upeIso} onChange={(e) => set("upeIso", e.target.value)}>
                {JURISDICTION_PACKS.map((p) => (
                  <option key={p.iso} value={p.iso}>{p.name} ({p.iso})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>UPE identification no.</span>
              <input className="input" value={draft.upeTin} onChange={(e) => set("upeTin", e.target.value)} placeholder="TIN / LEI (optional)" />
            </label>
            <label className="field">
              <span>Reporting Fiscal Year</span>
              <input className="input" value={draft.fy} onChange={(e) => set("fy", e.target.value)} placeholder="FY2026" />
            </label>
            <label className="field">
              <span>Period</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className="input" type="date" value={draft.fyStart} onChange={(e) => set("fyStart", e.target.value)} />
                <input className="input" type="date" value={draft.fyEnd} onChange={(e) => set("fyEnd", e.target.value)} />
              </div>
            </label>
          </div>

          <h5 className="sec-h" style={{ marginTop: 18 }}>3 · Scope window (USD millions)</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Art. 1.1 — in scope if two of the last four years are at or above $750m consolidated revenue. Leave blank if unknown; the file opens as out of scope until the pack is posted.</p>
          <div className="form-grid">
            <label className="field">
              <span>FY2023 revenue</span>
              <input className="input" inputMode="decimal" value={draft.rev23} onChange={(e) => set("rev23", e.target.value)} placeholder="e.g. 820" />
            </label>
            <label className="field">
              <span>FY2024 revenue</span>
              <input className="input" inputMode="decimal" value={draft.rev24} onChange={(e) => set("rev24", e.target.value)} placeholder="e.g. 910" />
            </label>
            <label className="field">
              <span>FY2025 revenue</span>
              <input className="input" inputMode="decimal" value={draft.rev25} onChange={(e) => set("rev25", e.target.value)} placeholder="e.g. 940" />
            </label>
            <label className="field">
              <span>FY2026 revenue</span>
              <input className="input" inputMode="decimal" value={draft.rev26} onChange={(e) => set("rev26", e.target.value)} placeholder="e.g. 980" />
            </label>
          </div>

          <h5 className="sec-h" style={{ marginTop: 18 }}>4 · People</h5>
          <div className="form-grid">
            <label className="field">
              <span>Engagement partner</span>
              <input className="input" value={draft.partner} onChange={(e) => set("partner", e.target.value)} placeholder="7-L Advisory" />
            </label>
            <label className="field">
              <span>Client tax lead</span>
              <input className="input" value={draft.clientLead} onChange={(e) => set("clientLead", e.target.value)} placeholder="Group Tax Director" />
            </label>
          </div>
          <div style={{ marginTop: 16 }}>
            <StartEngage kind="create" block onClick={submit} />
          </div>
        </section>

        <aside>
          <h5 className="sec-h">5 · Close pack you will drop</h5>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
            A file counts when classified and mapped. Required first; recommended next; incentive certificates only if claimed. AI maps; the engine calculates after approval.
          </p>
          {PACK_DOCS.map((d) => (
            <div key={d.kind} className="stack-row" style={{ fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{d.kind}</span>
                <span className={d.level === "required" ? "tag tag-outline" : "tag tag-neutral"}>
                  {d.level === "required" ? "Required" : d.level === "recommended" ? "Recommended" : "If needed"}
                </span>
              </div>
              <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{d.need}</div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
