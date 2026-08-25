"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ENTITIES } from "@/lib/model";
import { etrHref } from "@/lib/engine";
import { classifyAll, classFor, ENTITY_TEST_STEPS } from "@/lib/entityClass";
import { Amount } from "@/components/Amount";
import { useStore } from "@/lib/store";
import { useCalc } from "@/lib/useCalc";
import { intermediateParents, specialCharges, transparentEntities } from "@/lib/specialEntities";

export default function EntitiesPage() {
  const { ask, electionsOn } = useStore();
  const { calcs } = useCalc();
  const classes = classifyAll();
  const router = useRouter();
  const [sel, setSel] = useState(classes.find((c) => c.moce)?.id ?? classes.find((c) => c.pope)?.id ?? "TH-CE");
  const row = classFor(sel);
  const entity = ENTITIES.find((e) => e.id === sel)!;
  const jc = calcs.find((c) => c.entities.some((n) => n.id === sel));
  const moceN = classes.filter((c) => c.moce).length;
  const popeN = classes.filter((c) => c.pope).length;
  const ieN = classes.filter((c) => c.investment).length;
  const stN = classes.filter((c) => c.stateless).length;
  const charges = specialCharges({
    elect75: Object.entries(electionsOn).some(([k, v]) => v && k.startsWith("OECD_7.5")),
    elect76: Object.entries(electionsOn).some(([k, v]) => v && k.startsWith("OECD_7.6")),
  });
  const ipes = intermediateParents();
  const transparent = transparentEntities();

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>Entity test.</strong> Classification is computed from the ownership chain — not from the legal-entity type label. MOCE (UPE ownership ≤ 30%) and JV / Investment Entities are valued in a separate ETR blend. POPE (outsiders &gt; 20% of a non-UPE Parent) takes IIR first, with Inclusion Ratio. This snapshot: {moceN} MOCE, {popeN} POPE, {ieN} Investment Entity, {stN} Stateless.
        </div>
        <div className="stack-actions">
          <Link href="/graph" className="btn btn-secondary">Ownership graph</Link>
          <Link href="/thailand/entities" className="btn btn-secondary">Thai situs</Link>
          <Link href="/allocation" className="btn btn-secondary">QDMTT / IIR / UTPR</Link>
          <button className="btn btn-primary" onClick={() => ask("How does the entity test treat MOCE and POPE?")}>Ask GMT24</button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h4>Special entities · Art. 7 / 10.2 / IPE</h4>
          <span className="tag tag-outline">{ipes.length} IPE · {transparent.length} transparent · {charges.length} charge lines</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Kind</th><th>From</th><th>To</th><th>Ratio</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {charges.length === 0 ? (
                <tr><td colSpan={5} className="text-muted">Toggle Art. 7.5 / 7.6 on Elections to move IE income. IPE and tax-transparent flow lines always show.</td></tr>
              ) : charges.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.kind}</td>
                  <td>{c.fromId}</td>
                  <td>{c.toId ?? "—"}</td>
                  <td>{c.inclusionRatio}%</td>
                  <td style={{ fontSize: 12 }}>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted" style={{ margin: "8px 16px 16px", fontSize: 13 }}>
          IPE (not POPE): {ipes.map((e) => e.code).join(", ") || "—"}. Tax-transparent: {transparent.map((e) => e.code).join(", ") || "—"}. Art. 7.5/7.6 restatements apply when elected.
        </p>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {ENTITY_TEST_STEPS.map((s) => (
          <div key={s.n} className="panel">
            <div className="panel-body">
              <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)", fontWeight: 700 }}>{s.n}</div>
              <h4 style={{ margin: "8px 0 6px" }}>{s.title}</h4>
              <p className="text-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th><th>Entity</th><th>Type</th><th>GloBE class</th><th>Jur.</th><th>Direct %</th><th>UPE %</th><th>GAAP</th><th className="num">ETR</th><th>Blend</th><th>Review</th>
              </tr>
            </thead>
            <tbody>
              {ENTITIES.map((e) => {
                const cls = classes.find((c) => c.id === e.id)!;
                const c = calcs.find((x) => x.entities.some((n) => n.id === e.id));
                return (
                  <tr
                    key={e.id}
                    className="clickable"
                    onClick={() => setSel(e.id)}
                    style={sel === e.id ? { outline: "2px solid var(--color-accent)" } : undefined}
                  >
                    <td className="mono">{e.code}</td>
                    <td>{e.name}</td>
                    <td>{e.type}</td>
                    <td><span className={`tag ${cls.moce || cls.pope || cls.jv || cls.investment || cls.stateless ? "tag-warn" : "tag-ok"}`}>{cls.tag}</span></td>
                    <td>{e.iso}</td>
                    <td>{e.ownership}%</td>
                    <td>{cls.upeOwnership}%</td>
                    <td>{e.gaap}</td>
                    <td className="num"><Amount n={c?.etr ?? 0} audit={c?.trace.etr} compact /></td>
                    <td>{cls.blendKind}</td>
                    <td><span className="status-prep">{e.review}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h4 style={{ margin: 0 }}>{entity.name}</h4>
            <div className="text-muted" style={{ fontSize: 12 }}>{entity.code} · {row.tag} · look-through UPE {row.upeOwnership}% · outsiders {row.outsiderPct}%</div>
          </div>
          {jc && (
            <button className="btn btn-primary" onClick={() => router.push(etrHref(jc))}>Open {jc.name} ETR</button>
          )}
        </div>
        <div className="panel-body waterfall">
          {row.tests.map((t) => (
            <div key={t.id} className="wf-row">
              <span>{t.label}</span>
              <span style={{ textAlign: "right", maxWidth: 520 }}>
                <span className={`tag ${t.pass ? "tag-warn" : "tag-ok"}`} style={{ marginRight: 8 }}>{t.pass ? "Yes" : "No"}</span>
                {t.detail}
              </span>
            </div>
          ))}
          {jc && (
            <div className="wf-row total">
              <span>Valuation blend</span>
              <span>{jc.name} · ETR <Amount n={jc.etr} audit={jc.trace.etr} compact /> · top-up <Amount n={jc.jurisdictionalTopUp} audit={jc.audit} compact /></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
