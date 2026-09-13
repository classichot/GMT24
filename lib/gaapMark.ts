import { DATA, type Entity } from "./model";
import { gaapScreen } from "./fx";

export type GaapUsed = "upe" | "local";

export type GaapRow = {
  id: string;
  code: string;
  name: string;
  iso: string;
  gaap: string;
  /** What FANIL is actually computed on after the Art. 3.1.3 election and screens. */
  used: GaapUsed;
  localOnFile: boolean;
  localAllowed: boolean;
  elected: boolean;
  detail: string;
};

export function localGaapElected(electionsOn: Record<string, boolean> | undefined, entityId: string, iso: string) {
  return Boolean(electionsOn?.[`OECD_3.1.3@${iso}`] || electionsOn?.[`OECD_3.1.3@${entityId}`] || electionsOn?.["OECD_3.1.3"]);
}

export function gaapRow(e: Entity, electionsOn?: Record<string, boolean>): GaapRow {
  const f = DATA.financials.find((x) => x.entityId === e.id);
  const localOnFile = e.fanilLocal != null;
  const screen = gaapScreen({ basis: e.gaapBasis ?? "upe", upeFanil: f?.fanil ?? 0, localFanil: e.fanilLocal });
  const elected = localGaapElected(electionsOn, e.id, e.iso);
  const used: GaapUsed = elected && localOnFile && screen.localAllowed ? "local" : "upe";
  const detail = !localOnFile
    ? "UPE CFS (Art. 3.1.1) — no local-GAAP FANIL on file."
    : used === "local"
      ? `Local ${e.gaap} used (Art. 3.1.3 elected; screens pass).`
      : elected && !screen.localAllowed
        ? `Art. 3.1.3 elected but screens fail — stays on UPE CFS. ${screen.detail}`
        : `Local ${e.gaap} on file; screens ${screen.localAllowed ? "pass — elect OECD_3.1.3 to use it" : "fail"}. FANIL stays on UPE CFS (Art. 3.1.1).`;
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    iso: e.iso,
    gaap: e.gaap,
    used,
    localOnFile,
    localAllowed: screen.localAllowed,
    elected,
    detail,
  };
}

export function gaapRows(entities: Entity[], electionsOn?: Record<string, boolean>): GaapRow[] {
  return entities.map((e) => gaapRow(e, electionsOn));
}

export type GaapSummary = {
  iso: string;
  standards: string[];
  used: "upe" | "local" | "mixed";
  label: string;
  localAvailable: number;
  localUsed: number;
  rows: GaapRow[];
};

/** Jurisdiction / blend mark: which GAAP the FANIL for these CEs is computed on. */
export function gaapSummary(entities: Entity[], electionsOn?: Record<string, boolean>, iso?: string): GaapSummary {
  const rows = gaapRows(entities, electionsOn);
  const standards = [...new Set(rows.map((r) => r.gaap))];
  const usesLocal = rows.some((r) => r.used === "local");
  const usesUpe = rows.some((r) => r.used === "upe");
  const used = usesLocal && usesUpe ? "mixed" : usesLocal ? "local" : "upe";
  const localAvailable = rows.filter((r) => r.localOnFile && r.localAllowed).length;
  const localUsed = rows.filter((r) => r.used === "local").length;
  const std = standards.join(" / ") || "—";
  const label = used === "local"
    ? `${std} · local GAAP (Art. 3.1.3)`
    : used === "mixed"
      ? `${std} · mixed UPE CFS + local (Art. 3.1.3)`
      : localAvailable
        ? `${std} · UPE CFS (Art. 3.1.1) · ${localAvailable} CE${localAvailable === 1 ? "" : "s"} may elect local`
        : `${std} · UPE CFS (Art. 3.1.1)`;
  return { iso: iso ?? entities[0]?.iso ?? "", standards, used, label, localAvailable, localUsed, rows };
}

export function gaapByJurisdiction(electionsOn?: Record<string, boolean>): GaapSummary[] {
  const byIso = new Map<string, Entity[]>();
  for (const e of DATA.entities) {
    const list = byIso.get(e.iso) ?? [];
    list.push(e);
    byIso.set(e.iso, list);
  }
  return [...byIso.entries()].map(([iso, ents]) => gaapSummary(ents, electionsOn, iso));
}
