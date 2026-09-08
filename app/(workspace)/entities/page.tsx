"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DATA } from "@/lib/model";
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
  const fallbackId = classes.find((c) => c.moce)?.id ?? classes.find((c) => c.pope)?.id ?? DATA.entities[0]?.id ?? null;
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  // `undefined` = nothing clicked yet (show the most interesting entity); `null` = user collapsed the open row.
  const sel = picked === undefined ? fallbackId : picked && DATA.entities.some((e) => e.id === picked) ? picked : null;
  const toggle = (id: string) => setPicked((cur) => ((cur === undefined ? fallbackId : cur) === id ? null : id));
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
                <th aria-label="Expand" /><th>Code</th><th>Entity</th><th>Type</th><th>GloBE class</th><th>Jur.</th><th>Direct %</th><th>UPE %</th><th>GAAP</th><th className="num">ETR</th><th>Blend</th><th>Review</th>
              </tr>
            </thead>
            <tbody>
              {DATA.entities.map((e) => {
                const cls = classes.find((c) => c.id === e.id)!;
                const c = calcs.find((x) => x.entities.some((n) => n.id === e.id));
                const open = sel === e.id;
                return (
                  <Fragment key={e.id}>
                  <tr
                    className={`clickable${open ? " selected" : ""}`}
                    onClick={() => toggle(e.id)}
                    aria-expanded={open}
                    title={open ? "Hide the entity test" : "Show the entity test for this entity"}
                  >
                    <td style={{ width: 28, paddingRight: 0 }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
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
                  {open && (
                    <tr className="detail-row">
                      <td colSpan={12}>
                        <EntityDetail id={e.id} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

/** Entity test for one row, shown inline beneath the clicked entity. */
function EntityDetail({ id }: { id: string }) {
  const { ask } = useStore();
  const { calcs } = useCalc();
  const router = useRouter();
  const row = classFor(id);
  const entity = DATA.entities.find((e) => e.id === id);
  const jc = calcs.find((c) => c.entities.some((n) => n.id === id));
  if (!entity) return null;
  return (
    <div className="entity-detail">
      <div className="panel-head" style={{ padding: "0 0 10px", borderBottom: "2px solid var(--color-divider)", marginBottom: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>{entity.name}</h4>
          <div className="text-muted" style={{ fontSize: 12 }}>{entity.code} · {row.tag} · look-through UPE {row.upeOwnership}% · outsiders {row.outsiderPct}% · {entity.jurisdiction} · {entity.gaap}</div>
        </div>
        <div className="stack-actions">
          {jc && <button className="btn btn-primary" onClick={(ev) => { ev.stopPropagation(); router.push(etrHref(jc)); }}>Open {jc.name} ETR</button>}
          <button className="btn btn-secondary" onClick={(ev) => { ev.stopPropagation(); ask(`Explain the entity test for ${entity.name} (${entity.code})`); }}>Ask GMT24</button>
        </div>
      </div>
      <div className="waterfall">
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
  );
}
