"use client";

import Link from "next/link";
import { FX_RATES, type FxRow } from "@/lib/fx";

type FxEntity = { iso: string; fx: string; code?: string };

/** Locked FX rows that translate this jurisdiction's (or entity's) FANIL and taxes into presentation USD. */
export function fxRowsFor(entities: FxEntity[], iso: string): { row: FxRow | null; currency: string }[] {
  const currencies = [...new Set(entities.map((e) => e.fx))];
  if (currencies.length === 0) currencies.push(FX_RATES.find((r) => r.iso === iso)?.currency ?? "USD");
  return currencies.map((currency) => ({
    currency,
    row: FX_RATES.find((r) => r.iso === iso && r.currency === currency) ?? FX_RATES.find((r) => r.currency === currency) ?? null,
  }));
}

export function fxNoteText(entities: FxEntity[], iso: string): string {
  return fxRowsFor(entities, iso)
    .map(({ row, currency }) =>
      row
        ? `${row.pair} ${row.localPerUsd.toLocaleString("en-GB")} · ${row.asOf} · ${row.source}`
        : `${currency}: no locked rate`,
    )
    .join(" · ");
}

/**
 * Restates the exchange rate behind every USD figure on a calculation screen, so the
 * reviewer never has to leave the ETR / covered-tax / top-up view to find it.
 * Rates are the FY-locked table on /fx (Thailand: BOT Notification No. 6 on /thailand/fx).
 */
export function FxNote({ entities, iso, compact }: { entities: FxEntity[]; iso: string; compact?: boolean }) {
  const rows = fxRowsFor(entities, iso);
  const thai = iso === "TH";
  return (
    <div className="text-muted" style={{ fontSize: compact ? 11 : 12, display: "flex", flexWrap: "wrap", gap: compact ? 6 : 10, alignItems: "center" }}>
      <span className="tag tag-outline" style={{ fontSize: 10 }}>FX</span>
      {rows.map(({ row, currency }) =>
        row ? (
          <span key={currency} title={`${row.source} · locked for this snapshot`}>
            <span className="mono">1 USD = {row.localPerUsd.toLocaleString("en-GB")} {row.currency}</span>
            {row.currency === "USD" ? " (presentation currency)" : ` · as of ${row.asOf} · ${row.source}`}
          </span>
        ) : (
          <span key={currency} className="status-block">{currency}: no locked rate — add it on /fx before relying on USD figures</span>
        ),
      )}
      <Link href={thai ? "/thailand/fx" : "/fx"}>{thai ? "BOT rate engine" : "Locked FX table"}</Link>
    </div>
  );
}
