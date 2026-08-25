import { money } from "./format";
import { ENTITIES, FINANCIALS } from "./model";

export type Chapter6EventKind = "join" | "leave" | "reorg" | "transfer-6.3.4";

export type Chapter6Event = {
  id: string;
  kind: Chapter6EventKind;
  date: string;
  entityId: string;
  counterpartyId: string | null;
  iso: string;
  label: string;
  booksProceeds: number;
  globeCarrying: number;
  taxBasis: number;
  elected634: boolean;
  spread5y: boolean;
  evidence: string;
  note: string;
};

export type Chapter6Line = Chapter6Event & {
  globeGain: number;
  treatment: string;
  ruleId: string;
};

/**
 * Art. 6.1–6.3 group changes — joining / leaving, GloBE reorganisation, Art. 6.3.4 FV/tax-basis alignment.
 * Seeded FY2026 events for Aetherion; engine posts GloBE gain/loss when elected.
 */
export const CHAPTER6_EVENTS: Chapter6Event[] = [
  {
    id: "C6-JOIN-MY",
    kind: "join",
    date: "2026-04-01",
    entityId: "MY-MOS-A",
    counterpartyId: "MY-MOCE",
    iso: "MY",
    label: "Penang Tooling joins MOSG under MY-MOCE",
    booksProceeds: 0,
    globeCarrying: 2_200_000,
    taxBasis: 2_200_000,
    elected634: false,
    spread5y: false,
    evidence: "Aetherion_Legal_Entity_List_FY2026.xlsx · share purchase",
    note: "Art. 6.1 — joining Constituent Entity. GloBE attributes start from joining date carrying values.",
  },
  {
    id: "C6-LEAVE-AE",
    kind: "leave",
    date: "2025-12-15",
    entityId: "AE-CE",
    counterpartyId: null,
    iso: "AE",
    label: "UAE CE disposed (leaves MNE Group)",
    booksProceeds: 8_500_000,
    globeCarrying: 6_200_000,
    taxBasis: 5_800_000,
    elected634: false,
    spread5y: false,
    evidence: "Disposal_agreement_AE.pdf",
    note: "Art. 6.2 — leaving CE. Seller recognises GloBE gain on exit; target attributes leave the group.",
  },
  {
    id: "C6-REORG-SG",
    kind: "reorg",
    date: "2026-01-01",
    entityId: "SG-HC",
    counterpartyId: "JP-UPE",
    iso: "SG",
    label: "HoldCo share-for-share reorganisation under UPE",
    booksProceeds: 0,
    globeCarrying: 42_000_000,
    taxBasis: 42_000_000,
    elected634: false,
    spread5y: false,
    evidence: "Reorg_board_minute_2026-01.pdf",
    note: "Art. 6.3 GloBE reorganisation — no GloBE gain when qualifying conditions hold; historical carrying continues.",
  },
  {
    id: "C6-634-TH",
    kind: "transfer-6.3.4",
    date: "2026-03-01",
    entityId: "TH-CE",
    counterpartyId: "SG-HC",
    iso: "TH",
    label: "Intra-group IP / tooling contribution — FV vs tax-basis alignment",
    booksProceeds: 12_000_000,
    globeCarrying: 4_200_000,
    taxBasis: 4_200_000,
    elected634: true,
    spread5y: false,
    evidence: "Intra_group_transfer_register.xlsx · Art. 6.3.4 election pack",
    note: "Default keeps historical GloBE CV. Electing Art. 6.3.4 recognises FV / tax-basis adjustment.",
  },
];

export function chapter6Line(event: Chapter6Event, opts?: { elect634?: boolean; spread?: boolean }): Chapter6Line {
  const elect = opts?.elect634 ?? event.elected634;
  const spread = opts?.spread ?? event.spread5y;

  if (event.kind === "join") {
    return {
      ...event,
      globeGain: 0,
      treatment: "Art. 6.1 — joining CE; opening GloBE carrying from join date",
      ruleId: "OECD-C6-61",
    };
  }
  if (event.kind === "leave") {
    const gain = money(event.booksProceeds - event.globeCarrying);
    return {
      ...event,
      globeGain: gain,
      treatment: `Art. 6.2 — leaving CE; GloBE exit gain ${gain.toLocaleString("en-GB")}`,
      ruleId: "OECD-C6-62",
    };
  }
  if (event.kind === "reorg") {
    return {
      ...event,
      globeGain: 0,
      treatment: "Art. 6.3 — qualifying GloBE reorganisation; no gain, historical CV continues",
      ruleId: "OECD-C6-63",
    };
  }
  // transfer-6.3.4
  if (!elect) {
    return {
      ...event,
      globeGain: 0,
      treatment: "Art. 6.3.4 default — historical GloBE carrying value (no FV step-up)",
      ruleId: "OECD-C6-634",
    };
  }
  const full = money(event.booksProceeds - event.globeCarrying);
  const globeGain = spread ? money(full / 5) : full;
  return {
    ...event,
    elected634: true,
    spread5y: spread,
    globeGain,
    treatment: spread
      ? `Art. 6.3.4(c) elected — FV/tax-basis gain spread (FY slice ${globeGain.toLocaleString("en-GB")})`
      : `Art. 6.3.4 elected — FV/tax-basis gain ${globeGain.toLocaleString("en-GB")} in trigger year`,
    ruleId: "OECD-C6-634",
  };
}

export function chapter6Lines(opts?: { elect634?: Record<string, boolean>; spread?: Record<string, boolean> }) {
  return CHAPTER6_EVENTS.map((e) =>
    chapter6Line(e, {
      elect634: opts?.elect634?.[e.id],
      spread: opts?.spread?.[e.id],
    }),
  );
}

export function chapter6GlobeAdj(iso: string, electionsOn?: Record<string, boolean>) {
  const elect634 = Boolean(electionsOn?.[`OECD_6.3.4@${iso}`]);
  const spread = Boolean(electionsOn?.[`OECD_6.3.4c@${iso}`]);
  return money(
    chapter6Lines({
      elect634: Object.fromEntries(CHAPTER6_EVENTS.filter((e) => e.iso === iso).map((e) => [e.id, elect634 || e.elected634])),
      spread: Object.fromEntries(CHAPTER6_EVENTS.filter((e) => e.iso === iso).map((e) => [e.id, spread])),
    })
      .filter((l) => l.iso === iso)
      .reduce((a, l) => a + l.globeGain, 0),
  );
}

export function entityInGroup(entityId: string, asOf = "2026-12-31") {
  const leave = CHAPTER6_EVENTS.find((e) => e.kind === "leave" && e.entityId === entityId);
  if (leave && leave.date <= asOf) return false;
  const join = CHAPTER6_EVENTS.find((e) => e.kind === "join" && e.entityId === entityId);
  if (join && join.date > asOf) return false;
  return Boolean(ENTITIES.find((e) => e.id === entityId) || FINANCIALS.find((f) => f.entityId === entityId));
}
