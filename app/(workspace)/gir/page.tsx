"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DATA } from "@/lib/model";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { FlowBar } from "@/components/FlowBar";
import { useCalc } from "@/lib/useCalc";
import { buildGirPackage, downloadGir, downloadText } from "@/lib/gir";
import { DISSEMINATION_LABEL, SH_OPTION_LABEL, notificationText } from "@/lib/gir2026";

const num = (n: number) => n.toLocaleString("en-GB");

export default function GirPage() {
  const { flash, workflow, patchWorkflow, group, electionsOn, activeFy, packOverlay, historyEvents } = useStore();
  const { t, calcs } = useCalc();
  const pkg = useMemo(
    () => buildGirPackage({ group, calcs, electionsOn, activeFy, packOverlay, evidenceCount: historyEvents.length }),
    [group, calcs, electionsOn, activeFy, packOverlay, historyEvents.length],
  );
  const [selKey, setSelKey] = useState<string>("");
  const selected = pkg.jurisdictions.find((j) => j.calc.blendKey === selKey) ?? pkg.jurisdictions.find((j) => j.calc.iso === "TH") ?? pkg.jurisdictions[0];
  const [view, setView] = useState<"sections" | "setr" | "stish" | "ce" | "dissemination" | "annexB" | "annexC">("sections");

  const validate = () => {
    if (!pkg.validation.valid) {
      patchWorkflow({ girValidated: false });
      flash(`GIR validation failed · ${pkg.validation.errors.length} errors`);
      return;
    }
    patchWorkflow({ girValidated: true });
    flash(`GIR preflight passed · ${pkg.edition.short} · ${pkg.fieldCount} v1.0 elements · ${pkg.provisionalCount} September 2026 data points · official XSD validation still required`);
  };
  const exportXml = () => {
    if (!pkg.validation.valid) {
      flash("Fix GIR validation errors before export");
      return;
    }
    downloadGir(pkg, `${group.id}-${activeFy}-GIR-${pkg.edition.id}.xml`);
    patchWorkflow({ girExported: true });
    flash("Snapshot-driven GIR XML downloaded and evidence event sealed");
  };
  const exportNotifications = () => {
    const text = pkg.notifications.map(notificationText).join("\n\n" + "=".repeat(78) + "\n\n");
    downloadText(text, `${group.id}-${activeFy}-GIR-AnnexB-notifications.txt`);
    flash(`${pkg.notifications.length} Art. 8.1.3 notifications downloaded`);
  };

  const optionCount = pkg.jurisdictions.filter((j) => j.coding.primary).length;
  const reportableYes = pkg.jurisdictions.filter((j) => j.reportable.answer === "Yes");
  const ceRequired = pkg.jurisdictions.filter((j) => j.ceByCe.required);
  const schemaPending = pkg.edition.schema.status === "pending";

  return (
    <div>
      <FlowBar />
      <div className="callout" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>GIR Autopilot · {pkg.edition.short}.</strong> FY starts {group.fyStart}, so the {pkg.edition.title} governs this return (§36.1 — revised template for Fiscal Years commencing on or after 31 Dec 2025). The current entities, jurisdictional blends, safe-harbour option letters (a)–(k), Side-by-Side election, Simplified ETR and STISH data points, banded summary, reportable differences and QDMTT/IIR/UTPR collection populate the exchange structure.
          Group top-up {eur(t.topUp)}. {workflow.girValidated ? "Current package passed GMT24 preflight." : "Run preflight."} {workflow.girExported ? " XML exported." : ""}
          {schemaPending && <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>Schema: {pkg.edition.schema.note}</div>}
        </div>
        <div className="stack-actions">
          <button className="btn btn-secondary" onClick={validate}>Run preflight</button>
          <button className="btn btn-primary" onClick={exportXml}>Download XML</button>
          <button className="btn btn-secondary" onClick={exportNotifications}>Annex B notifications</button>
          <Link href="/elections" className="btn btn-secondary">Elections</Link>
          <Link href="/filings" className="btn btn-secondary">Filing matrix</Link>
          <Link href="/updates" className="btn btn-ghost">What changed</Link>
        </div>
      </div>

      <div className="kpi-grid cols-6" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-label">Template</div><div className="kpi-val" style={{ fontSize: 18 }}>{pkg.edition.short}</div><div className="kpi-sub">published {pkg.edition.publishedAt}</div></div>
        <div className="kpi"><div className="kpi-label">Schema</div><div className="kpi-val" style={{ fontSize: 18 }}>v{pkg.edition.schema.version.split(" ")[0]}</div><div className={`kpi-sub${schemaPending ? " hot" : ""}`}>{schemaPending ? "revised schema pending · no cut-off yet" : "published"}</div></div>
        <div className="kpi"><div className="kpi-label">Side-by-Side 1.3.1.6</div><div className="kpi-val" style={{ fontSize: 18 }}>{pkg.sbs.applies ? "Elected" : pkg.sbs.eligible ? "Available" : "N/A"}</div><div className="kpi-sub">{pkg.sbs.upeIso} UPE · {pkg.sbs.upeRegime}</div></div>
        <div className="kpi"><div className="kpi-label">SH options coded</div><div className="kpi-val" style={{ fontSize: 22 }}>{optionCount}/{pkg.jurisdictions.length}</div><div className="kpi-sub">2.2.1.1.1 letters (a)–(k)</div></div>
        <div className="kpi"><div className="kpi-label">Reportable differences</div><div className="kpi-val" style={{ fontSize: 22 }}>{reportableYes.length}</div><div className={`kpi-sub${reportableYes.length ? " hot" : ""}`}>{reportableYes.length ? reportableYes.map((j) => j.calc.iso).join(", ") + " → full Sections 2–3" : "none · 2.1.5"}</div></div>
        <div className="kpi"><div className="kpi-label">CE-by-CE Section 3</div><div className="kpi-val" style={{ fontSize: 22 }}>{ceRequired.length}</div><div className="kpi-sub">{ceRequired.length ? ceRequired.map((j) => j.calc.iso).join(", ") : "aggregate reporting"}</div></div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h4>Live GIR sections</h4><span className={pkg.validation.valid ? "status-done" : "status-block"}>{pkg.validation.valid ? "Ready" : `${pkg.validation.errors.length} errors`}</span></div>
          {DATA.girSections.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-divider)" }}>
              <div>
                <strong>{s.id}. {s.title}</strong>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {s.id === "A" && `${pkg.fieldCount} v1.0 elements · ${pkg.provisionalCount} Sep 2026 data points · ${pkg.messageRefId}`}
                  {s.id === "B" && `${pkg.entityCount} live entities/JV members${pkg.sbs.applies ? " · 1.3.1.7–9 suppressed (Side-by-Side)" : ""}`}
                  {s.id === "C" && `${pkg.jurisdictionCount} jurisdictional sections · ${eur(t.topUp)} top-up${pkg.sbs.applies ? " · summary 1.4 suppressed" : " · banded summary 1.4"}`}
                  {s.id === "D" && `${Object.values(electionsOn).filter(Boolean).length} elected switches · ${optionCount} option letters · Side-by-Side ${pkg.sbs.applies ? "elected" : "not elected"}`}
                  {s.id === "E" && `${pkg.dissemination.length} jurisdictions in the dissemination register · ${pkg.notifications.length} Annex B notifications`}
                </div>
              </div>
              <div className="stack-actions">
                {s.id === "D" && <Link href="/elections" className="btn btn-ghost">Election engine</Link>}
                <span className="status-prep">{s.id === "C" ? `Top-up ${eur(t.topUp, true)}` : "Populated"}</span>
              </div>
            </div>
          ))}
          <div className="panel-body">
            <strong>Validation profile</strong>
            <div className="text-muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>{pkg.schema}</div>
            {pkg.validation.checks.map((check) => (
              <div key={check.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderTop: "1px solid var(--color-divider)" }}>
                <span>{check.label}<div className="text-muted" style={{ fontSize: 11 }}>{check.detail}</div></span>
                <span className={check.pass ? "status-done" : "status-block"}>{check.pass ? "Pass" : "Fail"}</span>
              </div>
            ))}
            {pkg.validation.warnings.map((warning) => <p key={warning} className="text-muted" style={{ fontSize: 11, margin: "8px 0 0" }}>Warning · {warning}</p>)}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h4>September 2026 data points</h4>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([
                ["sections", "Summary 1.4"],
                ["setr", "Simplified ETR"],
                ["stish", "STISH"],
                ["ce", "CE-by-CE"],
                ["dissemination", "Dissemination"],
                ["annexB", "Annex B"],
                ["annexC", "Annex C"],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" className={`chip${view === key ? " active" : ""}`} onClick={() => setView(key)}>{label}</button>
              ))}
            </div>
          </div>

          {view === "sections" && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Jurisdiction</th><th>Rules</th><th>SH option</th><th>ETR band</th><th>Top-up band</th><th>SBIE &gt; NGI</th><th>QTI 1.4.10</th><th>2.1.5</th><th>Sections 2–3</th></tr></thead>
                <tbody>
                  {pkg.jurisdictions.map((j) => (
                    <tr key={j.calc.blendKey} onClick={() => setSelKey(j.calc.blendKey)} style={{ cursor: "pointer", background: selected?.calc.blendKey === j.calc.blendKey ? "var(--color-surface)" : undefined }}>
                      <td><strong>{j.calc.name}</strong><div className="text-muted" style={{ fontSize: 11 }}>{j.calc.blendKind}</div></td>
                      <td className="mono" style={{ fontSize: 11 }}>{j.summary.rules.map((r) => <span key={r.code} className={`tag ${r.provisional ? "tag-warn" : "tag-outline"}`} style={{ fontSize: 10, marginRight: 4 }} title={r.label}>{r.code}</span>)}</td>
                      <td>{j.coding.reported.length ? j.coding.reported.map((c) => <span key={c} className={`tag ${c === j.coding.primary ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: 10, marginRight: 4 }} title={SH_OPTION_LABEL[c]}>({c})</span>) : <span className="text-muted">full GloBE</span>}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{j.summary.etrBand}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{j.summary.topUpBand}</td>
                      <td>{j.summary.sbieExceedsNgi ? <span className="tag tag-warn" style={{ fontSize: 10 }}>Yes</span> : "No"}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{j.summary.qtiBand}</td>
                      <td>{j.reportable.answer === "Yes" ? <span className="tag tag-warn" style={{ fontSize: 10 }}>Yes</span> : j.reportable.answer}</td>
                      <td>{j.emitted ? <span className="status-done">Emitted</span> : <span className="status-prep">Suppressed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selected && (
                <div className="panel-body" style={{ borderTop: "1px solid var(--color-divider)" }}>
                  <strong>{selected.calc.name} — 2.2.1.1.1 option coding</strong>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>Primary {selected.coding.primary ? `(${selected.coding.primary}) ${SH_OPTION_LABEL[selected.coding.primary]}` : "none — full GloBE computation"}. Engine outcome {selected.calc.sh.outcome} · navigator {selected.calc.sh.navigator}.</div>
                  {selected.coding.options.map((o) => (
                    <div key={o.code} style={{ display: "flex", gap: 10, padding: "4px 0", borderTop: "1px solid var(--color-divider)", fontSize: 12, alignItems: "flex-start" }}>
                      <span className={`tag ${o.elected ? "tag-accent" : o.available ? "tag-outline" : "tag-neutral"}`} style={{ fontSize: 10, minWidth: 28, textAlign: "center" }}>({o.code})</span>
                      <span style={{ flex: 1 }}>{o.label}<div className="text-muted" style={{ fontSize: 11 }}>{o.result}{o.note ? ` · ${o.note}` : ""} · switches {o.switches.join(", ")}</div></span>
                      <span className={o.elected ? "status-done" : o.available ? "status-prep" : "text-muted"}>{o.elected ? "Reported" : o.available ? "Available" : "—"}</span>
                    </div>
                  ))}
                  {selected.coding.issues.map((i) => <p key={i} style={{ fontSize: 11, margin: "8px 0 0", color: "var(--color-hot)" }}>Issue · {i}</p>)}
                  {selected.coding.notes.map((i) => <p key={i} className="text-muted" style={{ fontSize: 11, margin: "8px 0 0" }}>Note · {i}</p>)}
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <strong>2.1.5 reportable differences: {selected.reportable.answer}.</strong> {selected.reportable.consequence}
                    {selected.reportable.taxingRights.length > 0 && <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Taxing rights: {selected.reportable.taxingRights.map((r) => `${r.name} (${r.basis})`).join(" · ")}</div>}
                    {selected.reportable.items.map((i) => <div key={i.id} style={{ fontSize: 11, marginTop: 4 }}><Link href={i.href} className="mono">{i.id}</Link> · {i.area} · {i.finding}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === "setr" && selected && (
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>2.2.1.2(b) Simplified ETR Safe Harbour — {selected.calc.name}</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>Data points [A]–[N] from CbCR profit before tax and the posted adjustments. Option (d) {selected.coding.reported.includes("d") ? "is elected — this block is emitted." : "is not elected — shown for review; switch SH_SETR / SETR_APPLY to report it."}</div>
                </div>
                <JurisdictionPicker value={selected.calc.blendKey} onChange={setSelKey} options={pkg.jurisdictions.map((j) => [j.calc.blendKey, `${j.calc.name} · ${j.calc.blendKind}`])} />
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Point</th><th>Data point</th><th style={{ textAlign: "right" }}>USD</th><th>Source</th></tr></thead>
                  <tbody>
                    {selected.setr.points.map((p) => (
                      <tr key={p.key} style={{ fontWeight: ["G", "H", "M", "N"].includes(p.key) ? 700 : 400 }}>
                        <td className="mono">[{p.key}]</td>
                        <td>{p.label}</td>
                        <td className="mono" style={{ textAlign: "right" }}>{p.value === null ? "—" : p.key === "N" ? pct(p.value, 2) : num(Math.round(p.value))}</td>
                        <td className="text-muted" style={{ fontSize: 11 }}>{p.source}{p.gap ? " · data gap" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <span className={selected.setr.passes15 === null ? "status-prep" : selected.setr.passes15 ? "status-done" : "status-block"}>{selected.setr.passes15 === null ? "No Simplified Income" : selected.setr.passes15 ? "Simplified ETR ≥ 15%" : "Simplified ETR < 15%"}</span>
                <span className="text-muted" style={{ marginLeft: 10 }}>Cross-fill: {selected.setr.crossFill.map((c) => `${c.from} → ${c.to} (${c.label})`).join(" · ")}</span>
              </div>
              {selected.setr.gaps.map((g) => <p key={g} className="text-muted" style={{ fontSize: 11, margin: "6px 0 0" }}>Note · {g}</p>)}
            </div>
          )}

          {view === "stish" && selected && (
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>2.2.1.2(c)–(d) Substance-based Tax Incentive Safe Harbour — {selected.calc.name}</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>Caps: 5.5% of eligible payroll or 5.5% of eligible-asset depreciation (larger base), or 1% of carrying value under the five-year STISH_CV election. Option (f) {selected.coding.reported.includes("f") ? "is elected — this block is emitted." : "is not elected."}</div>
                </div>
                <JurisdictionPicker value={selected.calc.blendKey} onChange={setSelKey} options={pkg.jurisdictions.map((j) => [j.calc.blendKey, `${j.calc.name} · ${j.calc.blendKind}`])} />
              </div>
              <div className="kpi-grid cols-4" style={{ marginBottom: 10 }}>
                <div className="kpi"><div className="kpi-label">Payroll cap 5.5%</div><div className="kpi-val" style={{ fontSize: 18 }}>{eur(selected.stish.payrollCap, true)}</div><div className="kpi-sub">on {eur(selected.stish.payrollBase, true)} eligible payroll</div></div>
                <div className="kpi"><div className="kpi-label">Depreciation cap 5.5%</div><div className="kpi-val" style={{ fontSize: 18 }}>—</div><div className="kpi-sub hot">data gap · fixed-asset register</div></div>
                <div className="kpi"><div className="kpi-label">Carrying value 1%</div><div className="kpi-val" style={{ fontSize: 18 }}>{eur(selected.stish.carryingValueCap, true)}</div><div className="kpi-sub">{selected.stish.carryingValueElected ? "STISH_CV elected" : "election not made"}</div></div>
                <div className="kpi"><div className="kpi-label">Total QTI</div><div className="kpi-val" style={{ fontSize: 18 }}>{eur(selected.stish.totalQti, true)}</div><div className={`kpi-sub${selected.stish.withinCap ? "" : " hot"}`}>{selected.stish.withinCap ? "within" : "exceeds"} {selected.stish.capBasis} cap {eur(selected.stish.applicableCap, true)}</div></div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Incentive</th><th>Entity</th><th>Type</th><th style={{ textAlign: "right" }}>Qualifying expenditure</th><th style={{ textAlign: "right" }}>QTI (proxy)</th><th>STISH-eligible</th></tr></thead>
                  <tbody>
                    {selected.stish.rows.length === 0 && <tr><td colSpan={6} className="text-muted">No incentive on this blend.</td></tr>}
                    {selected.stish.rows.map((r) => (
                      <tr key={`${r.incentiveId}-${r.entityId}`}>
                        <td><strong>{r.name}</strong><div className="mono text-muted" style={{ fontSize: 11 }}>{r.incentiveId}</div></td>
                        <td>{r.entityName}</td>
                        <td>{r.type}</td>
                        <td className="mono" style={{ textAlign: "right" }}>{r.traced ? num(r.qualifyingExpenditure) : "not traced"}</td>
                        <td className="mono" style={{ textAlign: "right" }}>{num(r.qtiProxy)}</td>
                        <td>{r.sbtishEligible ? <span className="tag tag-ok" style={{ fontSize: 10 }}>Yes</span> : <span className="tag tag-neutral" style={{ fontSize: 10 }}>No</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>QRTC / MTTC treated as QTI {eur(selected.stish.qrtcMttc)} · other QTIs {eur(selected.stish.otherQti)}.</div>
              {selected.stish.gaps.map((g) => <p key={g} className="text-muted" style={{ fontSize: 11, margin: "6px 0 0" }}>Note · {g}</p>)}
            </div>
          )}

          {view === "ce" && selected && (
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>Section 3 — {selected.calc.name}: {selected.ceByCe.required ? "Constituent-Entity detail required" : "jurisdictional aggregate"}</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>{selected.ceByCe.reason}</div>
                </div>
                <JurisdictionPicker value={selected.calc.blendKey} onChange={setSelKey} options={pkg.jurisdictions.map((j) => [j.calc.blendKey, `${j.calc.name} · ${j.calc.blendKind}`])} />
              </div>
              {selected.ceByCe.rows.length > 0 ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>CE</th><th>Type</th><th style={{ textAlign: "right" }}>FANIL</th><th style={{ textAlign: "right" }}>Adjustments</th><th style={{ textAlign: "right" }}>Current tax</th><th style={{ textAlign: "right" }}>Deferred tax</th><th style={{ textAlign: "right" }}>Payroll</th><th style={{ textAlign: "right" }}>Tangible</th></tr></thead>
                    <tbody>
                      {selected.ceByCe.rows.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.name}</strong><div className="mono text-muted" style={{ fontSize: 11 }}>{r.code}</div></td>
                          <td>{r.type}</td>
                          <td className="mono" style={{ textAlign: "right" }}>{num(r.fanil)}</td>
                          <td className="mono" style={{ textAlign: "right" }}>{num(r.adjustments)} <span className="text-muted">({r.adjustmentCount})</span></td>
                          <td className="mono" style={{ textAlign: "right" }}>{num(r.currentTax)}</td>
                          <td className="mono" style={{ textAlign: "right" }}>{num(r.deferredTax)}</td>
                          <td className="mono" style={{ textAlign: "right" }}>{num(r.payroll)}</td>
                          <td className="mono" style={{ textAlign: "right" }}>{num(r.tangible)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-muted" style={{ fontSize: 12 }}>Transitional Simplified Jurisdictional Reporting Framework (FYs beginning on or before 31 Dec 2028 and ending on or before 30 Jun 2030) — no entity rows needed.</p>}
            </div>
          )}

          {view === "dissemination" && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Jurisdiction</th><th>Category</th><th>Receives</th><th>Basis</th></tr></thead>
                <tbody>
                  {pkg.dissemination.map((d) => (
                    <tr key={d.iso}>
                      <td><strong>{d.name}</strong> <span className="mono text-muted">{d.iso}</span></td>
                      <td><span className={`tag ${d.category === "upe" ? "tag-accent" : d.category === "non-implementing" ? "tag-neutral" : "tag-outline"}`} style={{ fontSize: 10 }}>{d.category}</span><div className="text-muted" style={{ fontSize: 11 }}>{DISSEMINATION_LABEL[d.category]}</div></td>
                      <td style={{ fontSize: 12 }}>{d.receives.length ? d.receives.join(" · ") : "—"}</td>
                      <td className="text-muted" style={{ fontSize: 11 }}>{d.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="panel-body text-muted" style={{ fontSize: 11 }}>Central filing by the UPE / Designated Filing Entity; exchange under Qualifying Competent Authority Agreements (multilateral CAA developed) within three months of the filing deadline. Jurisdictions receive only the sections the dissemination approach assigns to them.</div>
            </div>
          )}

          {view === "annexB" && (
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>Annex B — Art. 8.1.3 notification that the GIR will be received under exchange of information</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>One per implementing jurisdiction with a Constituent Entity: A MNE Group · B entities and Designated Local Entity · C contact · D UPE · E Designated Filing Entity · F period.</div>
                </div>
                <button className="btn btn-secondary" onClick={exportNotifications}>Download all ({pkg.notifications.length})</button>
              </div>
              {pkg.notifications.map((n) => (
                <details key={n.iso} style={{ borderTop: "1px solid var(--color-divider)", padding: "8px 0" }}>
                  <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span><strong>{n.name}</strong> <span className="mono text-muted">{n.iso}</span> · {n.partB.entities.length} CE{n.partB.entities.length === 1 ? "" : "s"} · DLE {n.partB.designatedLocalEntity?.code ?? "—"}</span>
                    <span className="text-muted" style={{ fontSize: 11 }}>exchange by {n.exchangeBy}</span>
                  </summary>
                  <pre style={{ margin: "8px 0 0", padding: 12, fontSize: 11, background: "var(--color-surface)", whiteSpace: "pre-wrap" }}>{notificationText(n)}</pre>
                  <button className="btn btn-ghost" style={{ marginTop: 6 }} onClick={() => { downloadText(notificationText(n), `${group.id}-${activeFy}-GIR-AnnexB-${n.iso}.txt`); flash(`Annex B notification for ${n.name} downloaded`); }}>Download {n.iso}</button>
                </details>
              ))}
            </div>
          )}

          {view === "annexC" && (
            <div className="panel-body">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <div>
                  <strong>Annex C — transitional penalty relief</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>No penalties for GIR errors where the group has taken reasonable measures during the transition period ({pkg.penaltyRelief.window}). GMT24 tests the documentation it can see; the tax administration decides.</div>
                </div>
                <span className={pkg.penaltyRelief.status === "met" ? "status-done" : pkg.penaltyRelief.status === "gap" ? "status-block" : "status-prep"}>{pkg.penaltyRelief.status === "met" ? "Conditions met" : pkg.penaltyRelief.status === "gap" ? "Gap" : "Judgment"}</span>
              </div>
              {pkg.penaltyRelief.conditions.map((c) => (
                <div key={c.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderTop: "1px solid var(--color-divider)", fontSize: 12 }}>
                  <span>{c.label}<div className="text-muted" style={{ fontSize: 11 }}>{c.detail}</div></span>
                  <span className={c.met ? "status-done" : "status-block"}>{c.met ? "Met" : "Open"}</span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}><Link href="/agi/compliance" className="btn btn-ghost">Compliance review</Link> <Link href="/evidence-history" className="btn btn-ghost">Evidence history</Link></div>
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h4>XML preview</h4><span className="tag tag-accent">{pkg.edition.short} · GLOBEXML v{pkg.edition.schema.version.split(" ")[0]} · gir26 provisional</span></div>
        <pre style={{ margin: 0, padding: 16, fontSize: 12, overflow: "auto", maxHeight: 640, background: "var(--color-surface)" }}>{pkg.xml}</pre>
      </div>
    </div>
  );
}

function JurisdictionPicker({ value, onChange, options }: { value: string; onChange: (key: string) => void; options: [string, string][] }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 180 }}>
      {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select>
  );
}
