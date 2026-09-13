"use client";

import Link from "next/link";
import type { JurCalc } from "@/lib/engine";
import { etrHref } from "@/lib/engine";
import { eur } from "@/lib/format";

/**
 * Reviewer locators for the two negative-Covered-Tax articles:
 * Art. 4.1.5 (Net GloBE Loss + negative ACT → ACTTT) and
 * Art. 5.2.1 ENTE (Net GloBE Income + negative ACT → ETR floor 0%, Top-up % capped at 15%).
 */
export function ArticleLocators({ calcs }: { calcs: JurCalc[] }) {
  const a415 = calcs.filter((c) => c.globeIncome <= 0 && c.coveredTaxRaw < 0);
  const a521 = calcs.filter((c) => c.globeIncome > 0 && (c.coveredTaxRaw < 0 || c.enteOriginated > 0));
  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h4>Art. 4.1.5 / Art. 5.2.1 — where they fire this year</h4>
        <span className="tag tag-outline">{a415.length + a521.length} blends</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Article</th>
              <th>Test</th>
              <th>Blend</th>
              <th className="num">GloBE</th>
              <th className="num">ACT (raw)</th>
              <th className="num">Posted</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {a415.map((c) => (
              <tr key={`415-${c.blendKey}`}>
                <td><span className="tag tag-warn">Art. 4.1.5</span></td>
                <td>Net GloBE Loss + negative Adjusted Covered Taxes → Additional Current Top-up Tax (or ENTE carry-forward if OECD_4.1.5 is elected)</td>
                <td>{c.name}</td>
                <td className="num">{eur(c.globeIncome, true)}</td>
                <td className="num">{eur(c.coveredTaxRaw, true)}</td>
                <td className="num">ACTTT {eur(c.additionalCurrentTopUp, true)}</td>
                <td><Link href={etrHref(c)}>ETR</Link>{" · "}<Link href="/top-up">Top-up</Link>{" · "}<Link href="/elections">OECD_4.1.5</Link></td>
              </tr>
            ))}
            {a521.map((c) => (
              <tr key={`521-${c.blendKey}`}>
                <td><span className="tag tag-hot">Art. 5.2.1 ENTE</span></td>
                <td>Net GloBE Income + negative Adjusted Covered Taxes → Excess Negative Tax Expense is mandatory; ETR floors at 0%; Top-up % cannot exceed 15%</td>
                <td>{c.name}</td>
                <td className="num">{eur(c.globeIncome, true)}</td>
                <td className="num">{eur(c.coveredTaxRaw, true)}</td>
                <td className="num">ENTE carry-forward {eur(c.enteCarryforward, true)}</td>
                <td><Link href={etrHref(c)}>ETR</Link>{" · "}<Link href="/top-up">Top-up</Link></td>
              </tr>
            ))}
            {a415.length === 0 && a521.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted">No blend has negative Adjusted Covered Taxes this year — Art. 4.1.5 and Art. 5.2.1 ENTE do not fire.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
