import type { JurCalc } from "./engine";
import { money } from "./format";
import { thaiLiability, thaiSbie, thaiScopeMemo, THAI_PACK } from "./thailand";

export type GapKind = "aligned" | "overlay" | "diverge" | "pending" | "calc-gap";

export type GapRef = {
  side: "oecd" | "rd" | "gmt24";
  label: string;
  pin: string;
  href: string;
  origin: "external" | "module";
};

export type GapItem = {
  id: string;
  area: string;
  oecd: string;
  oecdCite: string;
  rd: string;
  rdCite: string;
  kind: GapKind;
  core: string;
  pack: string;
  action: string;
  href: string;
  play: string;
  ground: string;
  refs: GapRef[];
  finding?: string;
};

function oecd(pin: string, label = "GloBE Model Rules"): GapRef {
  return { side: "oecd", label, pin, href: THAI_PACK.oecdModelRules, origin: "external" };
}
function comm(pin: string): GapRef {
  return { side: "oecd", label: "OECD Consolidated Commentary 2026", pin, href: THAI_PACK.oecdCommentary, origin: "external" };
}
function central(pin: string): GapRef {
  return { side: "oecd", label: "OECD Central Record", pin, href: THAI_PACK.oecdCentralRecord, origin: "external" };
}
function decree(pin: string): GapRef {
  return { side: "rd", label: "Emergency Decree on Top-up Tax B.E. 2567", pin, href: THAI_PACK.rdDecree, origin: "external" };
}
function dg(pin: string): GapRef {
  return { side: "rd", label: "DG Notifications on Top-up Tax", pin, href: THAI_PACK.rdPage, origin: "external" };
}
function rdMap(pin: string): GapRef {
  return { side: "rd", label: "RD GloBE mapping table (17 Feb 2026)", pin, href: THAI_PACK.rdMappingPdf, origin: "external" };
}
function rdNews(pin: string): GapRef {
  return { side: "rd", label: "RD news 6/2025 — Decree promulgated", pin, href: THAI_PACK.rdDecreeNews, origin: "external" };
}
function rdSec(pin: string): GapRef {
  return { side: "rd", label: "RD news 5/2026 — draft secondary legislation", pin, href: THAI_PACK.rdSecondaryNews, origin: "external" };
}
function rule(id: string): GapRef {
  return { side: "gmt24", label: id, pin: "GMT24 rulebook", href: "/rulebook", origin: "module" };
}
function mod(href: string, label: string): GapRef {
  return { side: "gmt24", label, pin: "GMT24 module", href, origin: "module" };
}

const BASE: GapItem[] = [
  {
    id: "G-SCOPE",
    area: "Scope",
    oecd: "EUR 750m consolidated revenue in at least two of the four preceding Fiscal Years. Presentation currency of the UPE CFS.",
    oecdCite: "Art. 1.1 / OECD-SCOPE-750",
    rd: "Same 2-of-4 test, but EUR 750m is converted to THB at the BOT December-preceding midpoint. Short/long years prorated. Merger/demerger rules delegated.",
    rdCite: "Decree s 5 · DG Notification No. 6",
    kind: "diverge",
    core: "USD 750m window on the UPE presentation currency.",
    pack: "Thai Scope Memorandum runs the BOT THB window in parallel. Both determinations are stored.",
    action: "Do not file a Thai in-scope position from the OECD USD test alone. Lock BOT rates first.",
    href: "/thailand/scope",
    play: "01",
    ground: "Art. 1.1 tests EUR 750m in the UPE presentation currency. Decree s 5 uses the same 2-of-4 window but Notification No. 6 converts the threshold to THB at the BOT December-preceding midpoint. The two determinations can diverge.",
    refs: [oecd("Art. 1.1"), comm("Art. 1.1 Commentary"), decree("s 5"), dg("Notification No. 6"), rdMap("scope / FX rows"), rule("OECD-SCOPE-750"), mod("/thailand/scope", "Thai scope memorandum")],
  },
  {
    id: "G-GAAP",
    area: "Accounting standard",
    oecd: "Acceptable Financial Accounting Standard of the UPE, or an Authorised Financial Accounting Standard with material-difference adjustments.",
    oecdCite: "Art. 3.1.2–3.1.3",
    rd: "Whitelist of accepted standards and jurisdictions. EUR 75m presentation difference and EUR 1m permanent difference tests. Evidence of UPE consolidation policy.",
    rdCite: "DG Notification No. 1",
    kind: "overlay",
    core: "FANIL taken from UPE IFRS consolidation. No Thai whitelist check.",
    pack: "Accounting Standard Validator. Aetherion: IFRS UPE + TFRS Thai CEs — accepted. Material tests below threshold.",
    action: "Keep the UPE consolidation-policy memo in the evidence locker.",
    href: "/thailand/scope",
    play: "01",
    ground: "Art. 3.1.2–3.1.3 set the GloBE accounting standard. Notification No. 1 is the Thai whitelist and material-difference tests sitting on top of that article — not a different FANIL.",
    refs: [oecd("Art. 3.1.2–3.1.3"), comm("Art. 3.1 Commentary"), dg("Notification No. 1"), rdMap("acceptable accounting standard"), mod("/thailand/scope", "Accounting standard validator")],
  },
  {
    id: "G-FANIL",
    area: "GloBE income",
    oecd: "FANIL ± Art. 3.2. Engine posts. LLM never posts.",
    oecdCite: "Art. 3.1–3.2",
    rd: "Must be interpreted in line with GloBE. Detailed adjustment list is delegated to a further instrument.",
    rdCite: "Decree s 31 (pending)",
    kind: "pending",
    core: "Art. 3.2 deltas posted for TH001 (excluded dividends, net tax, FX hold).",
    pack: "Inherits Core. Does not invent s 31 adjustments.",
    action: "Document that Thai GloBE income currently follows OECD 3.2. Re-run when s 31 is published.",
    href: "/globe-income",
    play: "02",
    ground: "Art. 3.1–3.2 are in force in Core. Decree s 31 delegates the Thai adjustment list. Cabinet approved draft secondary legislation in principle on 30 Dec 2025 (RD news 5/2026) — it is not yet an in-pack instrument. GMT24 does not invent s 31.",
    refs: [oecd("Art. 3.1–3.2"), comm("Art. 3.2 Commentary"), decree("s 31 delegated"), rdSec("income / expense adjustment drafts"), rule("OECD-DIV-EXCL"), mod("/globe-income", "GloBE income")],
  },
  {
    id: "G-CT",
    area: "Covered taxes",
    oecd: "Art. 4.1–4.4 Adjusted Covered Taxes. Recast deferred tax at 15%.",
    oecdCite: "Art. 4.1 / 4.4 · OECD-DT-441",
    rd: "Covered-tax definition plus Notification No. 2 imputation / refundable-tax questionnaire. Detailed ACT rules delegated.",
    rdCite: "DG Notification No. 2 · Decree s 33 (pending)",
    kind: "pending",
    core: "Current + Art. 4.4 recast + other covered. Local business tax stripped.",
    pack: "Questionnaire stored. s 33 instrument not in pack — do not assert the Thai ACT equals OECD ACT forever.",
    action: "Keep Notification No. 2 answers with the tax provision. Flag s 33 as a filing exception.",
    href: "/thailand/scope",
    play: "02",
    ground: "Art. 4.1 / 4.4 are posted by Core (including the 15% recast). Notification No. 2 overlays the refundable-imputation questionnaire. Decree s 33 is still delegated; RD news 5/2026 flags draft covered-tax rules — pending, not booked.",
    refs: [oecd("Art. 4.1 / 4.4"), comm("Art. 4 Commentary"), dg("Notification No. 2"), decree("s 33 delegated"), rdSec("covered-tax drafts"), rule("OECD-DT-441"), mod("/deferred-tax", "Deferred tax intelligence")],
  },
  {
    id: "G-SITUS",
    area: "Entity location",
    oecd: "CE located where created, or PE jurisdiction. Dual-resident tie-breaker. Stateless CE treated as its own jurisdiction.",
    oecdCite: "Art. 10.3",
    rd: "Four PE categories, dual-resident treaty then covered-tax-paid then SBIE tie-breaker, flow-through, JV, MOCE, investment entity, excluded-entity tree.",
    rdCite: "DG Notifications No. 3, 7, 8",
    kind: "overlay",
    core: "Entity test posts CE / PE / JV / MOCE / POPE from the ownership chain. MOCE and JV are separate ETR blends. POPE takes IIR first. No Thai PE-category tree on Core.",
    pack: "Situs engine stores result, period, facts, evidence, Thai cite, OECD cite, reviewer.",
    action: "RD will ask for the PE category and excluded-entity conclusion. Do not send only the ownership graph.",
    href: "/thailand/entities",
    play: "01",
    ground: "Art. 10.1 / 10.3 locate the CE. Notifications No. 3, 7 and 8 are the Thai decision tree (PE category, excluded entity, MOCE / investment). Same location concept; more procedure.",
    refs: [oecd("Art. 10.1 / 10.3"), comm("Art. 10 Commentary"), dg("Notifications No. 3, 7, 8"), rdMap("entity location / excluded entity"), mod("/thailand/entities", "Thai entity situs")],
  },
  {
    id: "G-SBIE",
    area: "SBIE",
    oecd: "5% payroll + 5% tangible assets, with Art. 9.2 transitional rates. Eligible payroll and eligible tangible assets as defined in Art. 5.3.",
    oecdCite: "Art. 5.3 / 9.2 · OECD-SBIE-2026",
    rd: "Notification No. 4 data model: contractors, proportional days, capitalised payroll exclusion, ROU, licences, revaluation out, PE allocation. MOF No. 1 rates by fiscal-year start.",
    rdCite: "DG Notification No. 4 · MOF Notification No. 1",
    kind: "diverge",
    core: "Single eligible-payroll and eligible-asset totals × FY2026 9.4% / 7.4%.",
    pack: "Line-level Thai SBIE. Reconcile to Core. Difference is Notification No. 4 inclusions.",
    action: "File Thai SBIE from the pack, not from the OECD SBIE screen. Attach payroll and FAR evidence.",
    href: "/thailand/sbie",
    play: "02",
    ground: "Art. 5.3 / 9.2 set the carve-out. Notification No. 4 defines the Thai payroll and asset lines; MOF Notification No. 1 versions the rates by fiscal-year start. Rates match FY2026; the line items do not.",
    refs: [oecd("Art. 5.3 / 9.2"), comm("Art. 5.3 Commentary"), dg("Notification No. 4"), decree("MOF Notification No. 1 · related laws"), rdMap("SBIE payroll / tangible assets"), rule("OECD-SBIE-2026"), rule("TH-SBIE-MOF-1"), mod("/thailand/sbie", "Thai SBIE engine")],
  },
  {
    id: "G-ETR",
    area: "ETR and top-up",
    oecd: "ETR = Covered Taxes ÷ Net GloBE Income. Top-up % × Excess Profit after SBIE.",
    oecdCite: "Art. 5.1–5.2 · OECD-GloBE-15",
    rd: "Same 15% minimum. Interpreted in line with GloBE unless a Thai instrument overrides.",
    rdCite: "Decree ss 9–12",
    kind: "aligned",
    core: "Jurisdictional ETR and top-up posted by GMT24-CALC.",
    pack: "Inherits Core numbers. Does not recompute ETR in Thai.",
    action: "Click the Core amount. The Thai pack only changes who pays and which SBIE/FX overlays apply.",
    href: "/etr",
    play: "02",
    ground: "Art. 5.1–5.2 and Decree ss 9–12 are the same 15% ETR / top-up formula. The RD mapping table treats this as aligned. GMT24 does not restate ETR in Thai.",
    refs: [oecd("Art. 5.1–5.2"), comm("Art. 5 Commentary"), decree("ss 9–12"), rdMap("ETR / top-up tax"), rdNews("15% global minimum"), rule("OECD-GloBE-15"), mod("/etr", "Jurisdictional ETR")],
  },
  {
    id: "G-ORDER",
    area: "Collection order",
    oecd: "Qualified QDMTT first, then POPE IIR × Inclusion Ratio, then UPE IIR residual, then UTPR. MOCE/JV top-up is computed on a separate blend.",
    oecdCite: "Art. 2 / 10.1 · Central Record",
    rd: "Thai QDMTT, Thai IIR (Thai UPE / IPO / POPE), Thai UTPR allocation, foreign QDMTT/IIR reductions, designated-taxpayer election, joint and several.",
    rdCite: "Decree · DG Notification No. 5",
    kind: "overlay",
    core: "Thailand QDMTT collects the jurisdictional top-up. Residual IIR/UTPR $0 on Thai profits.",
    pack: "Liability waterfall + designated taxpayer + Notification No. 5 FTE/asset dataset (collection off in FY2026).",
    action: "Do not stop at the global allocation map. Name the Thai payer and keep the written election.",
    href: "/thailand/liability",
    play: "03",
    ground: "Art. 2 ordering is inherited. The Decree adds Thai QDMTT / IIR / UTPR, designated taxpayer and joint and several. Qualification of Thai QDMTT is read from the OECD Central Record, not invented.",
    refs: [oecd("Art. 2 QDMTT / IIR / UTPR"), central("Thailand transitional qualified QDMTT"), decree("QDMTT / IIR / UTPR chapters"), dg("Notification No. 5"), rdMap("domestic top-up / UTPR"), rule("TH-QDMTT-2025"), mod("/thailand/liability", "Thai liability dashboard")],
  },
  {
    id: "G-UTPR",
    area: "UTPR allocation",
    oecd: "UTPR percentage from number of employees and net book value of tangible assets in the UTPR jurisdiction.",
    oecdCite: "Art. 2.6",
    rd: "Separate dataset from SBIE. FTE method, PE de-duplication, 50/50 employees and assets, investment-entity exclusion, qualification from Central Record.",
    rdCite: "DG Notification No. 5",
    kind: "calc-gap",
    core: "No UTPR residual in this snapshot. No FTE allocation engine in Core.",
    pack: "Notification No. 5 register is locked even though Thailand does not collect UTPR in FY2026.",
    action: "Keep the FTE count method memo. Refresh qualification from the OECD Central Record, not a hard-coded list.",
    href: "/thailand/liability",
    play: "03",
    ground: "Art. 2.6 is the OECD allocation key. Notification No. 5 is the Thai FTE/asset dataset and is separate from SBIE. Core has no UTPR residual on this snapshot, so the pack holds the register as a data gap until collection is on.",
    refs: [oecd("Art. 2.6"), comm("Art. 2.6 Commentary"), dg("Notification No. 5"), central("UTPR qualification"), rdMap("UTPR allocation"), mod("/thailand/liability", "Thai UTPR allocation")],
  },
  {
    id: "G-FX",
    area: "Foreign exchange",
    oecd: "Amounts in the UPE presentation currency. Local books translated under the accounting standard.",
    oecdCite: "Art. 3.1.3 / Commentary",
    rd: "Three BOT methods: EUR thresholds → THB; CFS → THB for the threshold test; payment/refund → THB on last business day before approval.",
    rdCite: "DG Notification No. 6",
    kind: "diverge",
    core: "Presentation USD. No BOT lock.",
    pack: "Rates retrieved, locked, archived. Manual year-end rate raises a validation warning.",
    action: "Never convert a Thai payment at the CFS closing rate. Use the payment-method BOT rate.",
    href: "/thailand/fx",
    play: "01",
    ground: "Art. 3.1.3 keeps GloBE in the UPE presentation currency. Notification No. 6 locks three BOT conversion methods for Thai statutory tests and payments. Those rates are not the Core USD close.",
    refs: [oecd("Art. 3.1.3"), comm("currency / translation"), dg("Notification No. 6"), rdMap("foreign-exchange conversion"), mod("/thailand/fx", "BOT FX engine")],
  },
  {
    id: "G-FILE",
    area: "Filing",
    oecd: "GIR XML, 15-month deadline, exchange / local filing.",
    oecdCite: "GIR / XML schema",
    rd: "s 54 notification, ss 55–56 local GIR or exchange, s 57 Thai return and payment (15 months), s 58 first year 18 months. Forms and e-schema delegated.",
    rdCite: "Decree ss 53–58 (forms pending)",
    kind: "pending",
    core: "OECD GIR Autopilot XML.",
    pack: "Filing Command Centre clocks + s 57 schema-readiness field map. Thai return XML export stays gated until the RD schema is in the pack.",
    action: "Do not market GMT24 as fully ready for Thai filing. Hold GIR ≠ Thai return until the form pack is in. Use the readiness map to show what is mapped vs blocked.",
    href: "/thailand/filing",
    play: "03",
    ground: "The OECD GIR is not the Thai s 57 return. Decree ss 53–58 set the clocks; forms and e-schema remain delegated. RD news 6/2025 said filing would be electronic — the schema is not in this pack.",
    refs: [oecd("GIR / XML schema"), comm("administrative framework"), decree("ss 53–58"), rdNews("electronic filing / GIR"), rdSec("forms still secondary"), mod("/thailand/filing", "Filing command centre"), mod("/gir", "OECD GIR")],
  },
  {
    id: "G-BOI",
    area: "Tax incentives",
    oecd: "SBTISH may apply to substance-based incentives. Holiday income still sits in GloBE; low current tax lowers ETR.",
    oecdCite: "OECD-SBTISH v2026.2",
    rd: "Thai QDMTT collects the undertaxation. Designated taxpayer. RD will ask how much of the BOI benefit is recaptured.",
    rdCite: "Decree QDMTT · BOI certificate conditions",
    kind: "overlay",
    core: "BOI mapped as incentive; ETR reflects 0% CIT on promoted income.",
    pack: "Nominal BOI − Thai top-up − foreign IIR/UTPR = net retained value. Optimizer ranks keep / 10% / QRTC pending / 20% baseline.",
    action: "Open the BOI Optimizer. Report net retained incentive to the board, not headline 0% CIT. Do not book QRTC.",
    href: "/thailand/boi",
    play: "03",
    ground: "SBTISH (OECD 2026 package) may treat qualifying substance-based incentives as additions to covered taxes, subject to limits. Thai QDMTT still collects undertaxation on BOI holidays. The BOI press note and RD Decree page are the policy ground; GMT24 posts net retained value, not 0% CIT.",
    refs: [
      oecd("SBTISH — 2026 Side-by-Side package"),
      rule("OECD-SBTISH"),
      decree("QDMTT collects undertaxation"),
      { side: "rd", label: "BOI explanation of Pillar Two impact", pin: "press 137239", href: "https://www.boi.go.th/index.php?_module=news&from_page=press_releases2&language=th&page=press_releases_detail&topic_id=137239", origin: "external" },
      rdNews("large MNEs in scope of top-up tax"),
      rule("TH-BOI-OPT-2566"),
      mod("/thailand/boi", "BOI Optimizer"),
    ],
  },
  {
    id: "G-AUDIT",
    area: "Audit & penalties",
    oecd: "No Thai assessment window or surcharge. GIR process only.",
    oecdCite: "—",
    rd: "Ten-year assessment, information powers, 1× / 2× tax penalty, 1.5% monthly surcharge (0.75% if extended), cap at tax, filing penalty up to THB 200,000, 30-day appeal.",
    rdCite: "Decree audit / penalty chapters",
    kind: "overlay",
    core: "Calc-to-ledger trail. No Thai penalty engine.",
    pack: "Defence book + penalty calculator + 30-day summons calendar.",
    action: "Keep lineage to journal. Assemble the defence book before an RD request, not after.",
    href: "/thailand/audit",
    play: "03",
    ground: "OECD Model Rules do not set a Thai assessment window. The Decree audit and penalty chapters do. This is a Thai overlay, not a GloBE computational difference.",
    refs: [decree("audit / penalty / appeal"), rdNews("RD administration of top-up tax"), mod("/thailand/audit", "Audit defence book"), mod("/audit", "Calc-to-ledger trail")],
  },
  {
    id: "G-INTERP",
    area: "Interpretation",
    oecd: "Model Rules + 2026 Consolidated Commentary are the international measure.",
    oecdCite: "OECD Commentary 2026",
    rd: "Thai law must be interpreted in line with the international GloBE measures, except where the Decree or a notification specifically provides otherwise.",
    rdCite: "Decree interpretation clause",
    kind: "aligned",
    core: "OECD rulebook 2026.2.",
    pack: "Inherits Commentary. Thai override only where an instrument is in the pack.",
    action: "If OECD and RD conflict, cite the Thai instrument. If they do not, cite the Commentary — do not invent a Thai difference.",
    href: "/thailand",
    play: "01",
    ground: "The Decree interpretation clause and the RD mapping table (17 Feb 2026) are the authority for ‘aligned unless a Thai instrument overrides’. That is why GMT24 will not invent a Thai difference.",
    refs: [oecd("GloBE Model Rules"), comm("Consolidated Commentary 2026"), decree("interpretation in line with GloBE"), rdMap("master mapping table"), rdNews("drafted to OECD standard"), rule("TH-PACK-2567"), mod("/thailand", "Thailand pack")],
  },
];

export const GAP_PLAY = [
  { n: "01", title: "Separate the tests", body: "Open the source pin before anyone copies a GloBE number onto a Thai form. Scope, FX and situs each have an OECD article and a Thai instrument. Lock BOT rates and PE category first.", href: "/thailand/scope", hrefLabel: "Scope memo" },
  { n: "02", title: "Reconcile the numbers that diverge", body: "Thai SBIE (Notification No. 4) vs OECD SBIE. Covered-tax questionnaire vs Art. 4. FANIL stays on OECD 3.2 until s 31 exists — do not let the LLM fill the gap. Track back through the RD mapping PDF.", href: "/thailand/sbie", hrefLabel: "Thai SBIE" },
  { n: "03", title: "Order liability, then hold pending items", body: "QDMTT / IIR / UTPR waterfall and designated taxpayer. Document s 31, s 33 and ss 53–57 as coverage exceptions with the RD news citations. Do not tell the RD the GIR XML is the Thai return.", href: "/thailand/liability", hrefLabel: "Liability" },
];

export function uniqueGapSources(items: GapItem[]) {
  const seen = new Set<string>();
  const out: GapRef[] = [];
  for (const g of items) {
    for (const r of g.refs) {
      const k = `${r.side}|${r.href}|${r.label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

export function reviewOecdRdGap(th: JurCalc) {
  const sbie = thaiSbie();
  const scope = thaiScopeMemo();
  const L = thaiLiability(th);
  const sbieDelta = money(sbie.sbie - th.sbie);
  const items = BASE.map((g) => {
    if (g.id === "G-SCOPE") {
      return {
        ...g,
        finding: `OECD Core: IN SCOPE on USD 750m (group presentation). Thai BOT test: ${scope.status} (${scope.hits} of ${scope.window} years). Threshold ${scope.thresholdThb.toLocaleString("en-GB")} THB.`,
      };
    }
    if (g.id === "G-SBIE") {
      return {
        ...g,
        finding: `OECD SBIE ${th.sbie.toLocaleString("en-GB")} vs Thai SBIE ${sbie.sbie.toLocaleString("en-GB")} (delta ${sbieDelta.toLocaleString("en-GB")}). Rates match FY-start 9.4% / 7.4%; the delta is Notification No. 4 line items.`,
      };
    }
    if (g.id === "G-ORDER") {
      return {
        ...g,
        finding: `Core jurisdictional top-up ${th.jurisdictionalTopUp.toLocaleString("en-GB")} = Thai QDMTT payable ${L.payable.toLocaleString("en-GB")}. Foreign QDMTT $0 · IIR $0 · residual UTPR $0.`,
      };
    }
    if (g.id === "G-ETR") {
      return {
        ...g,
        finding: `Thai ETR ${(th.etr * 100).toFixed(2)}% · top-up ${th.jurisdictionalTopUp.toLocaleString("en-GB")}. Pack does not restate. BOI is the driver, not a Thai computational difference.`,
      };
    }
    if (g.id === "G-FILE") {
      return {
        ...g,
        finding: `OECD GIR XML can be drafted. Thai s 57 return schema is pending. First in-scope year ${THAI_PACK.firstInScopeFy} used the 18-month clock.`,
      };
    }
    return { ...g, finding: `${g.core} ${g.pack}` };
  });

  const count = (k: GapKind) => items.filter((i) => i.kind === k).length;

  return {
    pack: THAI_PACK.id,
    version: THAI_PACK.version,
    items,
    sources: uniqueGapSources(items),
    counts: {
      aligned: count("aligned"),
      overlay: count("overlay"),
      diverge: count("diverge"),
      pending: count("pending"),
      calcGap: count("calc-gap"),
      total: items.length,
    },
    sbieDelta,
    oecdSbie: th.sbie,
    thaiSbieAmt: sbie.sbie,
    oecdScope: "IN SCOPE",
    thaiScope: scope.status,
    payable: L.payable,
    topUp: th.jurisdictionalTopUp,
    fileReady: false,
    headline: `${count("diverge")} diverge · ${count("pending")} pending RD instruments · ${count("calc-gap")} Core data gaps`,
  };
}

export const GAP_KIND_LABEL: Record<GapKind, string> = {
  aligned: "Aligned",
  overlay: "Thai overlay",
  diverge: "Diverges",
  pending: "RD pending",
  "calc-gap": "Core data gap",
};

export const GAP_REF_SIDE: Record<GapRef["side"], string> = {
  oecd: "OECD",
  rd: "Thai RD",
  gmt24: "GMT24",
};
