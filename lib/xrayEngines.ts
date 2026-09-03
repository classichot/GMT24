import {
  ADJUSTMENTS,
  ENTITIES,
  FILES,
  FINANCIALS,
  INCENTIVES,
  type Entity,
  type Financials,
} from "./model";
import { CIT_RATE, deferredTaxRegister, enrich, recaptureClocks } from "./deferredTax";
import { BOI_CERTS } from "./boiOptimizer";
import { PAYROLL_LINES, ASSET_LINES } from "./thailand";
import { classFor } from "./entityClass";
import { electionById } from "./elections";
import { money } from "./format";
import {
  type EvidenceKind,
  type XrayBranch,
  type XrayFinding,
  type XrayQuestion,
  type XraySeverity,
} from "./xray";

/**
 * Detection engines for Pillar Two X-Ray.
 *
 * Every finding here is derived from the canonical model — trial-balance amounts,
 * the entity register, the deferred-tax sub-ledger, incentive records and the
 * source-file inventory. Nothing is an authored finding: if the underlying data
 * changes, the detections change with it. That is the point of the module, since
 * the risk being managed is a mathematically correct answer built on facts the
 * source data cannot actually prove.
 */

const PAYROLL_RATE = 0.05;
const ASSET_RATE = 0.05;
const MATERIAL_AT = 2_000_000;
const SIGNIFICANT_AT = 500_000;

function sev(amount: number, floor?: XraySeverity): XraySeverity {
  const byAmount: XraySeverity = Math.abs(amount) >= MATERIAL_AT
    ? "material"
    : Math.abs(amount) >= SIGNIFICANT_AT
      ? "significant"
      : "observation";
  if (!floor) return byAmount;
  const rank: Record<XraySeverity, number> = { observation: 0, significant: 1, material: 2 };
  return rank[floor] > rank[byAmount] ? floor : byAmount;
}

function ent(id: string): Entity | undefined {
  return ENTITIES.find((e) => e.id === id);
}

function fin(id: string): Financials | undefined {
  return FINANCIALS.find((f) => f.entityId === id);
}

function base(e: Entity) {
  return {
    entityId: e.id,
    entityCode: e.code,
    entityName: e.name,
    iso: e.iso,
    jurisdiction: e.jurisdiction,
  };
}

function hasFile(kind: string, entityId: string) {
  return FILES.some((f) => f.kind === kind && f.entity === entityId);
}

function yesNo(id: string, prompt: string, dept: XrayFinding["dept"], yes: string, no: string): XrayQuestion {
  return { id, prompt, dept, options: [{ value: "yes", label: yes }, { value: "no", label: no }] };
}

// ---------------------------------------------------------------------------
// 1 · Dividend DNA
// ---------------------------------------------------------------------------

/**
 * Art. 3.2.1(b) turns on the four-box test: portfolio versus non-portfolio
 * shareholding against short versus long holding period. Only a portfolio
 * shareholding held under one year stays in GloBE income. A trial balance shows
 * the credit but never the ownership percentage or the holding period, so every
 * claimed exclusion is an assumption until the share register proves it.
 */
export function dividendXray(): XrayFinding[] {
  return ADJUSTMENTS.filter((a) => a.category === "Excluded dividends").map((a) => {
    const e = ent(a.entityId)!;
    const amount = a.original;
    const questions: XrayQuestion[] = [
      {
        id: `${a.id}-box`,
        prompt: "Four-box classification of the receipt at the distribution date",
        dept: "Legal",
        options: [
          { value: "nonportfolio", label: "Non-portfolio — ownership ≥ 10%" },
          { value: "portfolio-long", label: "Portfolio < 10%, held ≥ 1 year" },
          { value: "portfolio-short", label: "Portfolio < 10%, held < 1 year" },
          { value: "not-equity", label: "Not a distribution on an equity interest" },
        ],
      },
      {
        id: `${a.id}-payer`,
        prompt: "Distributing entity, its jurisdiction and whether it is a Group Entity",
        dept: "Finance",
        options: [
          { value: "group", label: "Group Entity — intra-group distribution" },
          { value: "third", label: "Third party outside the Group" },
        ],
      },
      {
        id: `${a.id}-period`,
        prompt: "Economic holding period — acquisition and distribution dates on the register",
        dept: "Legal",
        options: [
          { value: "dated", label: "Dated register supplied — period verified" },
          { value: "undated", label: "No dated register — period cannot be evidenced" },
        ],
        dependsOn: { questionId: `${a.id}-box`, value: "portfolio-long" },
      },
      {
        id: `${a.id}-symmetry`,
        prompt: "Does the distributing entity treat the instrument as equity as well?",
        dept: "Legal",
        options: [
          { value: "symmetric", label: "Symmetric — equity on both sides" },
          { value: "asymmetric", label: "Asymmetric — deducted by the payer" },
        ],
        dependsOn: { questionId: `${a.id}-box`, value: "nonportfolio" },
      },
      yesNo(
        `${a.id}-wht`,
        "Was withholding tax suffered on the receipt?",
        "Tax",
        "Yes — withholding tax deducted",
        "No withholding tax",
      ),
    ];
    const excluded: XrayBranch = {
      value: "nonportfolio",
      label: "Non-portfolio ≥ 10%",
      treatment: "Excluded Dividend under Art. 3.2.1(b). The exclusion stands and the associated tax must come out of Covered Taxes with it.",
      globeIncomeDelta: 0,
      coveredTaxDelta: 0,
      sbieDelta: 0,
    };
    return {
      id: `XR-DIV-${a.id}`,
      engine: "dividend" as const,
      area: "GloBE income" as const,
      severity: sev(amount),
      title: `Excluded dividend claimed without ownership or holding-period proof`,
      detected: `${a.reason.split(",")[0]} — ${amount.toLocaleString("en-GB")} credited to account ${a.account ?? "—"} and excluded from GloBE income.`,
      missing: "Ownership percentage at the distribution date, economic holding period, whether the payer is a Group Entity, and instrument symmetry.",
      amount,
      ...base(e),
      account: a.account,
      adjustmentId: a.id,
      ruleId: a.ruleId,
      article: "Art. 3.2.1(b)",
      owner: a.preparer,
      dept: "Legal" as const,
      sourceDoc: a.sourceDoc,
      evidence: ["Share register", "Dividend voucher", "Investment ledger"] as EvidenceKind[],
      questions,
      branches: [
        excluded,
        { ...excluded, value: "portfolio-long", label: "Portfolio < 10% held ≥ 1 year", treatment: "Excluded Dividend. The one-year holding period is met, so the portfolio shareholding does not carry the receipt back into GloBE income." },
        {
          value: "portfolio-short",
          label: "Portfolio < 10% held < 1 year",
          treatment: "Short-term Portfolio Shareholding. The receipt is NOT an Excluded Dividend and returns to GloBE income; any withholding tax suffered returns to Covered Taxes.",
          globeIncomeDelta: amount,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "not-equity",
          label: "Not an equity distribution",
          treatment: "Interest, a service fee or a return of capital rather than a distribution on an ownership interest. The Art. 3.2.1(b) exclusion is reversed in full.",
          globeIncomeDelta: amount,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `Provide the share register and dividend voucher proving the ownership percentage and holding period behind the ${amount.toLocaleString("en-GB")} dividend excluded from GloBE income at ${e.code}. Without them the exclusion is not established.`,
      href: "/globe-income",
    };
  });
}

// ---------------------------------------------------------------------------
// 2 · Payroll Eligibility & Location
// ---------------------------------------------------------------------------

/**
 * The Art. 5.3 payroll carve-out needs eligible employees performing activities
 * in the jurisdiction. Payroll cost per head that is far above a normal
 * employment profile usually means contractors, outsourced labour or capitalised
 * payroll sit inside the claimed base — none of which are eligible.
 */
export function payrollXray(): XrayFinding[] {
  const out: XrayFinding[] = [];

  for (const f of FINANCIALS) {
    const e = ent(f.entityId);
    if (!e || f.employees <= 0 || f.payrollEligible <= 0) continue;
    const perHead = f.payrollEligible / f.employees;
    if (perHead <= 200_000) continue;
    const carve = money(f.payrollEligible * PAYROLL_RATE);
    out.push({
      id: `XR-PAY-HEAD-${e.id}`,
      engine: "payroll",
      area: "Payroll SBIE",
      severity: sev(carve, "significant"),
      title: "Payroll cost per head implies non-employee costs in the carve-out base",
      detected: `${e.code} claims ${f.payrollEligible.toLocaleString("en-GB")} of eligible payroll across ${f.employees} employees — ${money(perHead).toLocaleString("en-GB")} per head. The carve-out claimed is ${carve.toLocaleString("en-GB")}.`,
      missing: "Split between employees and independent contractors, and whether capitalised payroll or outsourced labour is inside the base.",
      amount: carve,
      ...base(e),
      ruleId: "OECD-SBIE-2026",
      article: "Art. 5.3.3",
      owner: "HR",
      dept: "HR",
      sourceDoc: "Payroll report — not received",
      evidence: ["Employment records", "Payroll report"],
      questions: [
        {
          id: `pay-head-${e.id}-mix`,
          prompt: "Composition of the claimed payroll base",
          dept: "HR",
          options: [
            { value: "employees", label: "Employees only — no contractors or capitalised payroll" },
            { value: "contractors", label: "Includes independent contractors or outsourced labour" },
            { value: "capitalised", label: "Includes payroll capitalised into asset carrying value" },
          ],
        },
        yesNo(`pay-head-${e.id}-direction`, "Are the individuals directed and controlled by the Constituent Entity?", "HR", "Yes — direction and control evidenced", "No — supplied through a service provider"),
      ],
      branches: [
        {
          value: "employees",
          label: "Employees only",
          treatment: "The full base is eligible payroll. Carve-out stands at 5% of the claimed amount.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "contractors",
          label: "Contractors included",
          treatment: "Independent contractors are eligible only where they participate in ordinary operating activities under the direction of the Constituent Entity. Excluding the excess over a normal employment profile reduces the carve-out.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money((f.payrollEligible - f.employees * 200_000) * PAYROLL_RATE),
        },
        {
          value: "capitalised",
          label: "Capitalised payroll included",
          treatment: "Payroll capitalised into the carrying value of tangible assets is excluded from the payroll carve-out to prevent the same cost supporting both carve-outs.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money((f.payrollEligible - f.employees * 200_000) * PAYROLL_RATE),
        },
      ],
      rdChallenge: `${e.code} claims ${money(perHead).toLocaleString("en-GB")} of eligible payroll per employee. Produce the employment records showing these are employees performing activities in ${e.jurisdiction}, not contracted labour.`,
      href: "/sbie",
    });
  }

  const noRegister = FINANCIALS
    .filter((f) => {
      const e = ent(f.entityId);
      return e && f.payrollEligible * PAYROLL_RATE >= 1_000_000 && !hasFile("Payroll", f.entityId);
    })
    .sort((a, b) => b.payrollEligible - a.payrollEligible)
    .slice(0, 3);

  for (const f of noRegister) {
    const e = ent(f.entityId)!;
    const carve = money(f.payrollEligible * PAYROLL_RATE);
    out.push({
      id: `XR-PAY-LOC-${e.id}`,
      engine: "payroll",
      area: "Payroll SBIE",
      severity: sev(carve),
      title: "Payroll carve-out claimed with no work-location evidence",
      detected: `${e.code} claims ${carve.toLocaleString("en-GB")} of payroll carve-out on ${f.payrollEligible.toLocaleString("en-GB")} of eligible payroll, but no payroll register has been received for this entity.`,
      missing: "Employee-level payroll with the jurisdiction of work, and a local-work percentage for anyone working partly outside the jurisdiction.",
      amount: carve,
      ...base(e),
      ruleId: "OECD-SBIE-2026",
      article: "Art. 5.3.3",
      owner: "Local Finance",
      dept: "HR",
      sourceDoc: "Payroll report — not received",
      evidence: ["Payroll report", "Employment records", "Work-location / travel data"],
      questions: [
        {
          id: `pay-loc-${e.id}-where`,
          prompt: `Do all claimed employees perform their activities in ${e.jurisdiction}?`,
          dept: "HR",
          options: [
            { value: "all", label: `All activities performed in ${e.jurisdiction}` },
            { value: "partial", label: "Some employees work partly outside the jurisdiction" },
            { value: "outside", label: "A group works predominantly outside the jurisdiction" },
          ],
        },
        {
          id: `pay-loc-${e.id}-split`,
          prompt: "Local-work percentage supported by travel or time records",
          dept: "HR",
          options: [
            { value: "measured", label: "Measured from time or travel records" },
            { value: "estimated", label: "Estimated — no underlying records" },
          ],
          dependsOn: { questionId: `pay-loc-${e.id}-where`, value: "partial" },
        },
        yesNo(`pay-loc-${e.id}-second`, "Are any individuals seconded in from another Constituent Entity?", "HR", "Yes — secondment agreements exist", "No secondments"),
      ],
      branches: [
        {
          value: "all",
          label: "All work in the jurisdiction",
          treatment: "Full eligible payroll qualifies. The carve-out stands once the payroll register is attached.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "partial",
          label: "Partly outside",
          treatment: "Payroll for employees working partly outside the jurisdiction is included in proportion to time worked in it. A 25% out-of-jurisdiction profile is priced here pending the measured split.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money(carve * 0.25),
        },
        {
          value: "outside",
          label: "Predominantly outside",
          treatment: "Payroll for employees working predominantly outside the jurisdiction is excluded from this jurisdiction's carve-out entirely.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money(carve * 0.5),
        },
      ],
      rdChallenge: `${e.code} claims a ${carve.toLocaleString("en-GB")} payroll carve-out. Produce the employee-level payroll register showing each individual's jurisdiction of work, with the local-work percentage for anyone working partly outside ${e.jurisdiction}.`,
      href: "/sbie",
    });
  }

  for (const f of FINANCIALS) {
    const e = ent(f.entityId);
    if (!e || f.employees <= 0 || f.payrollEligible > 0) continue;
    out.push({
      id: `XR-PAY-NIL-${e.id}`,
      engine: "payroll",
      area: "Payroll SBIE",
      severity: "observation",
      title: "Personnel present but no eligible payroll claimed",
      detected: `${e.code} reports ${f.employees} employees and nil eligible payroll, so no payroll carve-out is being claimed for this entity.`,
      missing: "Whether payroll is borne by another Constituent Entity, and which jurisdiction those individuals actually work in.",
      amount: 0,
      ...base(e),
      ruleId: "OECD-SBIE-2026",
      article: "Art. 5.3.3",
      owner: "Group Tax",
      dept: "HR",
      sourceDoc: "Entity register",
      evidence: ["Employment records", "Secondment agreement"],
      questions: [
        {
          id: `pay-nil-${e.id}-who`,
          prompt: "Who bears the payroll cost for these individuals?",
          dept: "HR",
          options: [
            { value: "elsewhere", label: "Another Constituent Entity bears and claims the cost" },
            { value: "here", label: "This entity bears the cost — carve-out understated" },
          ],
        },
      ],
      branches: [
        {
          value: "elsewhere",
          label: "Borne elsewhere",
          treatment: "No carve-out arises here. Confirm the bearing entity claims it only for time worked in its own jurisdiction.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "here",
          label: "Borne by this entity",
          treatment: "The carve-out is understated. Eligible payroll must be brought in, which reduces top-up tax in this jurisdiction.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: money(f.employees * 40_000 * PAYROLL_RATE),
        },
      ],
      rdChallenge: `${e.code} reports ${f.employees} personnel with no payroll. Identify which entity bears the cost and confirm the substance carve-out is not being claimed twice.`,
      href: "/sbie",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 3 · Tangible Asset Eligibility & Location
// ---------------------------------------------------------------------------

/**
 * The Art. 5.3 asset carve-out is measured on consolidated carrying values for
 * tangible assets located in the jurisdiction. A fixed-asset register is the only
 * thing that bridges the accounting balance to the eligible base and proves situs.
 */
export function assetXray(): XrayFinding[] {
  const out: XrayFinding[] = [];

  const noRegister = FINANCIALS
    .filter((f) => {
      const e = ent(f.entityId);
      return e && f.tangibleEligible * ASSET_RATE >= 1_000_000 && !hasFile("Fixed-asset register", f.entityId);
    })
    .sort((a, b) => b.tangibleEligible - a.tangibleEligible)
    .slice(0, 3);

  for (const f of noRegister) {
    const e = ent(f.entityId)!;
    const carve = money(f.tangibleEligible * ASSET_RATE);
    out.push({
      id: `XR-AST-REG-${e.id}`,
      engine: "asset",
      area: "Tangible asset SBIE",
      severity: sev(carve),
      title: "Asset carve-out claimed with no carrying-value bridge",
      detected: `${e.code} claims ${carve.toLocaleString("en-GB")} of asset carve-out on ${f.tangibleEligible.toLocaleString("en-GB")} of eligible tangible assets, with no fixed-asset register received to bridge the consolidated carrying value to the eligible base.`,
      missing: "Asset-level opening and closing carrying values, exclusion of ineligible categories, and the location of each asset.",
      amount: carve,
      ...base(e),
      ruleId: "OECD-SBIE-2026",
      article: "Art. 5.3.4",
      owner: "Fixed assets",
      dept: "Fixed assets",
      sourceDoc: "Fixed-asset register — not received",
      evidence: ["Fixed-asset register", "Lease agreement"],
      questions: [
        {
          id: `ast-reg-${e.id}-cat`,
          prompt: "Does the claimed base contain any ineligible category?",
          dept: "Fixed assets",
          options: [
            { value: "clean", label: "Tangible operating assets only" },
            { value: "held-for-sale", label: "Includes assets held for sale or investment property" },
            { value: "reval", label: "Includes a revaluation uplift above cost" },
          ],
        },
        {
          id: `ast-reg-${e.id}-situs`,
          prompt: `Are all claimed assets located in ${e.jurisdiction}?`,
          dept: "Fixed assets",
          options: [
            { value: "in", label: `All located in ${e.jurisdiction}` },
            { value: "mixed", label: "Some assets located in another jurisdiction" },
          ],
        },
        {
          id: `ast-reg-${e.id}-lease`,
          prompt: "Treatment of leased assets in the base",
          dept: "Legal",
          options: [
            { value: "none", label: "No leased assets in the base" },
            { value: "rou", label: "Lessee right-of-use assets included" },
            { value: "lessor", label: "Assets leased out to third parties included" },
          ],
        },
      ],
      branches: [
        {
          value: "clean",
          label: "Operating assets only",
          treatment: "The claimed base is eligible once the register is attached and situs is confirmed.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "held-for-sale",
          label: "Held for sale or investment",
          treatment: "Assets held for sale, lease or investment are excluded from Eligible Tangible Assets and come out of the carve-out base.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money(carve * 0.2),
        },
        {
          value: "reval",
          label: "Revaluation uplift included",
          treatment: "Only the carrying value recognised in the consolidated financial statements qualifies. A revaluation uplift above that basis is stripped out.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money(carve * 0.15),
        },
      ],
      rdChallenge: `${e.code} claims a ${carve.toLocaleString("en-GB")} asset carve-out. Produce the fixed-asset register reconciling the consolidated carrying value to the eligible base and evidencing that each asset is located in ${e.jurisdiction}.`,
      href: "/sbie",
    });
  }

  for (const f of FINANCIALS) {
    const e = ent(f.entityId);
    if (!e || f.employees <= 0 || f.tangibleEligible <= 0) continue;
    const perHead = f.tangibleEligible / f.employees;
    if (perHead <= 400_000) continue;
    if (out.some((o) => o.entityId === e.id)) continue;
    const carve = money(f.tangibleEligible * ASSET_RATE);
    out.push({
      id: `XR-AST-SITUS-${e.id}`,
      engine: "asset",
      area: "Tangible asset SBIE",
      severity: sev(carve, "significant"),
      title: "Asset base far exceeds the local operating footprint",
      detected: `${e.code} claims ${f.tangibleEligible.toLocaleString("en-GB")} of eligible tangible assets against ${f.employees} employees — ${money(perHead).toLocaleString("en-GB")} per head. Asset situs, not ownership, decides which jurisdiction may claim them.`,
      missing: "Physical location of each asset, whether any are operated by another Constituent Entity, and whether intangible or right-of-use balances have been included.",
      amount: carve,
      ...base(e),
      ruleId: "OECD-SBIE-2026",
      article: "Art. 5.3.4",
      owner: "Fixed assets",
      dept: "Fixed assets",
      sourceDoc: "Fixed-asset register — not received",
      evidence: ["Fixed-asset register", "Lease agreement", "Corporate structure document"],
      questions: [
        {
          id: `ast-situs-${e.id}-where`,
          prompt: `Physical location of the claimed asset base`,
          dept: "Fixed assets",
          options: [
            { value: "in", label: `Located and operated in ${e.jurisdiction}` },
            { value: "abroad", label: "Material assets physically located in another jurisdiction" },
          ],
        },
        yesNo(`ast-situs-${e.id}-intangible`, "Does the balance include intangible assets or capitalised development cost?", "Finance", "Yes — intangibles included", "No — tangible only"),
      ],
      branches: [
        {
          value: "in",
          label: "Located in the jurisdiction",
          treatment: "The base qualifies where the assets are physically present and used in ordinary operating activities.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "abroad",
          label: "Located abroad",
          treatment: "Assets located outside the jurisdiction cannot support its carve-out. They move to the jurisdiction where they sit, which can raise top-up tax here and lower it elsewhere.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: -money(carve * 0.4),
        },
      ],
      rdChallenge: `${e.code} carries ${money(perHead).toLocaleString("en-GB")} of claimed tangible assets per employee. Evidence the physical location of those assets and confirm no intangible or right-of-use balance is inside the carve-out base.`,
      href: "/sbie",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 4 · BOI Privilege X-Ray
// ---------------------------------------------------------------------------

/**
 * An incentive certificate is a legal instrument, not a rate. Whether the benefit
 * is a tax holiday, a reduced rate, a Qualified Refundable Tax Credit or a
 * Marketable Transferable Tax Credit changes where it lands in the GloBE
 * calculation — income, covered tax, or nothing at all — and each treatment
 * depends on enacted local law rather than the accounting entry.
 */
export function boiXray(): XrayFinding[] {
  const byEntity = new Map<string, number>();
  for (const i of INCENTIVES) byEntity.set(i.entityId, (byEntity.get(i.entityId) ?? 0) + 1);

  const rows = INCENTIVES.map((i) => {
    const e = ent(i.entityId);
    const f = fin(i.entityId);
    if (!e || !f) return null;
    const statutory = CIT_RATE[e.iso] ?? 0.2;
    const forgone = Math.max(0, money(f.fanil * statutory - f.currentTax));
    const share = forgone / (byEntity.get(i.entityId) ?? 1);
    const cert = BOI_CERTS.find((c) => c.entityId === i.entityId);
    const credit = /credit|allowance/i.test(i.type);
    return { i, e, benefit: money(share), cert, credit, statutory };
  }).filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => r.benefit >= 1_000_000 || r.credit)
    .sort((a, b) => b.benefit - a.benefit)
    .slice(0, 5);

  return rows.map(({ i, e, benefit, cert, credit, statutory }) => {
    const questions: XrayQuestion[] = [
      {
        id: `boi-${i.id}-kind`,
        prompt: "Enacted legal character of the benefit",
        dept: "BOI / project",
        options: [
          { value: "holiday", label: "Exemption or reduced rate — reduces tax payable" },
          { value: "qrtc", label: "Qualified Refundable Tax Credit — refundable within four years" },
          { value: "mttc", label: "Marketable Transferable Tax Credit — legally transferable" },
          { value: "other", label: "Non-qualified credit — reduces covered tax" },
        ],
      },
      {
        id: `boi-${i.id}-enacted`,
        prompt: "Is the refundability or transferability written into enacted law rather than practice?",
        dept: "Legal",
        options: [
          { value: "enacted", label: "Enacted in law — statutory reference available" },
          { value: "practice", label: "Administrative practice only" },
        ],
        dependsOn: { questionId: `boi-${i.id}-kind`, value: "qrtc" },
      },
      {
        id: `boi-${i.id}-cap`,
        prompt: "Cap base and benefit consumed to date",
        dept: "BOI / project",
        options: [
          { value: "tracked", label: "Cap base and cumulative utilisation reconciled" },
          { value: "untracked", label: "Cap utilisation not tracked against the certificate" },
        ],
      },
      {
        id: `boi-${i.id}-period`,
        prompt: "Does the privilege period change part-way through this Fiscal Year?",
        dept: "Tax",
        options: [
          { value: "no", label: "No — one rate applies for the whole year" },
          { value: "yes", label: "Yes — holiday or reduced rate expires mid-year" },
        ],
      },
      yesNo(`boi-${i.id}-substance`, "Is qualifying expenditure traced for the substance-based incentive tests?", "BOI / project", "Yes — expenditure traced", "No — not traced"),
    ];
    return {
      id: `XR-BOI-${i.id}`,
      engine: "boi" as const,
      area: "Incentives" as const,
      severity: sev(benefit, credit ? "significant" : undefined),
      title: credit
        ? "Tax credit not classified against the enacted-law gate"
        : "Incentive privilege not decomposed from the certificate",
      detected: `${i.name} at ${e.code}: "${i.rate}" running ${i.start} to ${i.end}. Statutory rate for ${e.jurisdiction} is ${(statutory * 100).toFixed(1)}%, implying roughly ${benefit.toLocaleString("en-GB")} of tax forgone this year.${cert ? ` Certificate record present with ${cert.remainingCapUsd.toLocaleString("en-GB")} of stated cap headroom, but no utilisation ledger stands behind it.` : " No structured certificate record exists — the privilege is held as narrative text."}`,
      missing: credit
        ? "Whether the credit is refundable within four years or legally transferable, and the enacted statutory basis for that treatment."
        : "Privilege components, cap base and cumulative utilisation, exemption percentage by period, and the conditions attached to the promotion.",
      amount: benefit,
      ...base(e),
      ruleId: "OECD-GloBE-15",
      article: credit ? "Art. 3.2.4 / QRTC definition" : "Art. 4.1 · incentive characterisation",
      owner: "BOI / project owner",
      dept: "BOI / project" as const,
      sourceDoc: i.extractedFrom,
      evidence: ["BOI certificate", "Tax return", "Corporate structure document"] as EvidenceKind[],
      questions,
      branches: [
        {
          value: "holiday",
          label: "Exemption or reduced rate",
          treatment: "The benefit lowers tax payable, so it lowers Adjusted Covered Taxes and pushes the ETR down. No income is added. This is the treatment currently assumed.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "qrtc",
          label: "Qualified Refundable Tax Credit",
          treatment: "A QRTC is treated as GloBE income rather than a reduction of Covered Taxes. Income rises and the ETR improves — but only if refundability within four years is in enacted law.",
          globeIncomeDelta: benefit,
          coveredTaxDelta: benefit,
          sbieDelta: 0,
        },
        {
          value: "mttc",
          label: "Marketable Transferable Tax Credit",
          treatment: "An MTTC is also treated as income, subject to the marketability conditions on origination and transfer. Confirm the legal transferability before booking.",
          globeIncomeDelta: benefit,
          coveredTaxDelta: benefit,
          sbieDelta: 0,
        },
        {
          value: "other",
          label: "Non-qualified credit",
          treatment: "A non-qualified credit reduces Adjusted Covered Taxes, lowering the ETR and increasing top-up tax. Do not gross up income.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -benefit,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${e.code} relies on ${i.name}. Produce the certificate showing the promoted activity, exemption percentage, cap base, cumulative utilisation and privilege period, and the enacted statutory basis for the treatment adopted in the calculation.`,
      href: e.iso === "TH" ? "/thailand/boi" : "/incentives",
    };
  });
}

// ---------------------------------------------------------------------------
// 5 · Deferred Tax X-Ray
// ---------------------------------------------------------------------------

/**
 * The deferred-tax adjustment only works if each temporary difference is known
 * individually: its origination year sets the Art. 4.4.4 five-year recapture
 * clock, and its reversal profile decides whether the clock is ever met.
 * An aggregate movement cannot answer either question.
 */
export function deferredXray(): XrayFinding[] {
  const out: XrayFinding[] = [];
  const register = deferredTaxRegister();

  for (const p of register.filter((r) => r.id.startsWith("DT-PLUG"))) {
    const e = ent(p.entityId);
    if (!e) continue;
    const v = enrich(p);
    const amount = Math.abs(v.pnl);
    out.push({
      id: `XR-DT-PLUG-${p.entityId}`,
      engine: "deferred",
      area: "Deferred tax",
      severity: sev(amount, "significant"),
      title: "Deferred tax movement not attributed to a temporary difference",
      detected: `${e.code} carries ${amount.toLocaleString("en-GB")} of deferred tax movement that reconciles the sub-ledger to the reported charge but is not attached to an identified temporary difference.`,
      missing: "The underlying temporary differences making up the residual, each with its own origination year, category and expected reversal.",
      amount,
      ...base(e),
      ruleId: "OECD-DT-4.4.1",
      article: "Art. 4.4.1",
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: p.evidence,
      evidence: ["Deferred-tax schedule", "Tax-provision workpaper"],
      questions: [
        {
          id: `dt-plug-${p.entityId}-what`,
          prompt: "What does the unattributed movement represent?",
          dept: "Tax",
          options: [
            { value: "identified", label: "Identified temporary differences — schedule available" },
            { value: "valuation", label: "Valuation allowance movement on a deferred tax asset" },
            { value: "unknown", label: "Cannot be attributed from available records" },
          ],
        },
        yesNo(`dt-plug-${p.entityId}-globe`, "Does any part relate to income excluded from GloBE income?", "Tax", "Yes — relates to excluded income", "No — all GloBE relevant"),
      ],
      branches: [
        {
          value: "identified",
          label: "Attributable",
          treatment: "Once each difference is identified the recast and recapture tests can run properly. No change to the current charge.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "valuation",
          label: "Valuation allowance",
          treatment: "A movement in a valuation allowance is excluded from the Total Deferred Tax Adjustment Amount, so it comes out of Adjusted Covered Taxes.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -amount,
          sbieDelta: 0,
        },
        {
          value: "unknown",
          label: "Unattributable",
          treatment: "An unattributable movement cannot be shown to satisfy Art. 4.4.1. The prudent treatment is to exclude it from Adjusted Covered Taxes until the schedule arrives.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -amount,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${e.code} includes ${amount.toLocaleString("en-GB")} of deferred tax in Adjusted Covered Taxes without identifying the temporary differences behind it. Produce the deferred-tax schedule reconciling every movement.`,
      href: "/deferred-tax",
    });
  }

  const noReversal = new Map<string, { count: number; amount: number }>();
  for (const p of register) {
    if (p.side !== "DTL" || !p.globeRelevant || p.exception || p.expectedReversalYear !== null) continue;
    const v = enrich(p);
    const cur = noReversal.get(p.iso) ?? { count: 0, amount: 0 };
    noReversal.set(p.iso, { count: cur.count + 1, amount: cur.amount + Math.abs(v.globeClosing) });
  }
  for (const [iso, agg] of [...noReversal.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 2)) {
    const e = ENTITIES.find((x) => x.iso === iso);
    if (!e) continue;
    out.push({
      id: `XR-DT-REV-${iso}`,
      engine: "deferred",
      area: "Deferred tax",
      severity: sev(agg.amount, "material"),
      title: "Deferred tax liabilities with no expected reversal year",
      detected: `${agg.count} GloBE-relevant deferred tax liabilit${agg.count === 1 ? "y" : "ies"} in ${e.jurisdiction} totalling ${money(agg.amount).toLocaleString("en-GB")} carry no expected reversal year and no Recapture Exception Accrual.`,
      missing: "Expected reversal year for each liability, so the Art. 4.4.4 five-year recapture test can be applied to its origination vintage.",
      amount: money(agg.amount),
      ...base(e),
      ruleId: "OECD-DT-4.4.4",
      article: "Art. 4.4.4",
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: "Deferred_tax_rollforward.xlsx",
      evidence: ["Deferred-tax schedule", "Tax-provision workpaper"],
      questions: [
        {
          id: `dt-rev-${iso}-profile`,
          prompt: "Reversal profile of these liabilities",
          dept: "Tax",
          options: [
            { value: "within5", label: "Expected to reverse within five years" },
            { value: "beyond5", label: "Expected to reverse beyond five years" },
            { value: "exception", label: "Recapture Exception Accrual category" },
          ],
        },
        yesNo(`dt-rev-${iso}-rate`, "Is the domestic rate used for the recast the enacted rate for the reversal period?", "Tax", "Yes — enacted rate confirmed", "No — rate not confirmed"),
      ],
      branches: [
        {
          value: "within5",
          label: "Reverses within five years",
          treatment: "The liability satisfies Art. 4.4.4 and stays in the Total Deferred Tax Adjustment Amount. No recapture arises.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "beyond5",
          label: "Reverses beyond five years",
          treatment: "A liability that does not reverse within five years is recaptured: the origination year's ETR is recomputed without it and Additional Current Top-up Tax arises in that year.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -money(agg.amount),
          sbieDelta: 0,
        },
        {
          value: "exception",
          label: "Recapture Exception Accrual",
          treatment: "Recapture Exception Accrual categories are outside the five-year test. Confirm the category qualifies before relying on it.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${money(agg.amount).toLocaleString("en-GB")} of ${e.jurisdiction} deferred tax liabilities have no stated reversal year. Demonstrate that each reverses within five years of origination or accept recapture in the origination year.`,
      href: "/deferred-tax",
    });
  }

  for (const f of FINANCIALS) {
    const e = ent(f.entityId);
    if (!e || f.deferredTax === 0) continue;
    if (f.priorDta !== 0 || f.priorDtl !== 0) continue;
    const amount = Math.abs(f.deferredTax);
    out.push({
      id: `XR-DT-OPEN-${e.id}`,
      engine: "deferred",
      area: "Deferred tax",
      severity: sev(amount, "significant"),
      title: "Deferred tax charge with no opening balances",
      detected: `${e.code} reports a ${amount.toLocaleString("en-GB")} deferred tax movement with nil opening deferred tax asset and liability. A movement without an opening position cannot be rolled forward or recast.`,
      missing: "Opening deferred tax asset and liability by temporary difference, and the transition-year attributes brought into the regime.",
      amount,
      ...base(e),
      ruleId: "OECD-DT-9.1.1",
      article: "Art. 9.1.1",
      owner: "Local Tax",
      dept: "Tax",
      sourceDoc: "Deferred-tax schedule — not received",
      evidence: ["Deferred-tax schedule", "Tax return"],
      questions: [
        {
          id: `dt-open-${e.id}-why`,
          prompt: "Why are opening balances nil?",
          dept: "Tax",
          options: [
            { value: "first-year", label: "First year of corporate income tax in this jurisdiction" },
            { value: "not-supplied", label: "Balances exist but have not been supplied" },
          ],
        },
        yesNo(`dt-open-${e.id}-transition`, "Are transition-year attributes recast to the lower of the domestic rate and 15%?", "Tax", "Yes — recast applied", "No — not recast"),
      ],
      branches: [
        {
          value: "first-year",
          label: "First taxable year",
          treatment: "Nil opening balances are correct where corporate income tax commenced in the year. The closing position becomes next year's opening vintage.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "not-supplied",
          label: "Not supplied",
          treatment: "Without opening balances the deferred tax movement cannot be substantiated and is excluded from Adjusted Covered Taxes until the roll-forward arrives.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -amount,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${e.code} claims a deferred tax movement with no opening position. Produce the deferred tax roll-forward, or accept that the movement is not established.`,
      href: "/deferred-tax",
    });
  }

  for (const clock of recaptureClocks("TH")) {
    if (clock.status !== "approaching" && clock.status !== "recapture") continue;
    const e = ent("TH-CE")!;
    out.push({
      id: `XR-DT-CLOCK-${clock.originYear}`,
      engine: "deferred",
      area: "Deferred tax",
      severity: sev(clock.remaining, "material"),
      title: "Five-year recapture clock running on an origination vintage",
      detected: `${money(clock.remaining).toLocaleString("en-GB")} of Thai deferred tax liabilities originating in FY${clock.originYear} have not reversed. The Art. 4.4.4 deadline is the end of FY${clock.deadlineYear}.`,
      missing: "The origination-year GloBE income and Covered Taxes needed to recompute that year's ETR if the liability is recaptured.",
      amount: money(clock.remaining),
      ...base(e),
      ruleId: "OECD-DT-4.4.4",
      article: "Art. 4.4.4",
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: "Deferred_tax_rollforward.xlsx",
      evidence: ["Deferred-tax schedule", "Tax return", "Tax-provision workpaper"],
      questions: [
        {
          id: `dt-clock-${clock.originYear}-plan`,
          prompt: `Will the FY${clock.originYear} vintage reverse before the end of FY${clock.deadlineYear}?`,
          dept: "Tax",
          options: [
            { value: "reverse", label: "Yes — reversal scheduled within the deadline" },
            { value: "recapture", label: "No — recapture will be triggered" },
          ],
        },
        yesNo(`dt-clock-${clock.originYear}-origin`, `Are the FY${clock.originYear} GloBE income and Covered Taxes available to recompute that year's ETR?`, "Tax", "Yes — origin-year figures available", "No — origin year not reconstructable"),
      ],
      branches: [
        {
          value: "reverse",
          label: "Reverses in time",
          treatment: "No recapture. The liability stays in the Total Deferred Tax Adjustment Amount for the origination year.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "recapture",
          label: "Recapture triggered",
          treatment: `The FY${clock.originYear} ETR is recomputed excluding the liability and Additional Current Top-up Tax arises for that year.`,
          globeIncomeDelta: 0,
          coveredTaxDelta: -money(clock.remaining),
          sbieDelta: 0,
        },
      ],
      rdChallenge: `Thai deferred tax liabilities originating in FY${clock.originYear} remain outstanding. Show the reversal schedule, or recompute the FY${clock.originYear} effective tax rate and pay the recapture.`,
      href: "/deferred-tax",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 6 · Covered Tax Classification
// ---------------------------------------------------------------------------

/**
 * Two symmetry rules do most of the work here. A tax that is not a Covered Tax
 * must leave the numerator, and a tax attaching to income excluded from GloBE
 * income must leave with that income. Both are invisible in a tax charge line.
 */
export function coveredXray(): XrayFinding[] {
  const out: XrayFinding[] = [];

  const nonCovered = FINANCIALS
    .filter((f) => f.nonCovered > 0 && ent(f.entityId))
    .sort((a, b) => b.nonCovered - a.nonCovered)
    .slice(0, 3);

  for (const f of nonCovered) {
    const e = ent(f.entityId)!;
    out.push({
      id: `XR-CT-NC-${e.id}`,
      engine: "covered",
      area: "Covered taxes",
      severity: sev(f.nonCovered, "significant"),
      title: "Tax flagged non-covered but still inside the ETR numerator",
      detected: `${e.code} reports ${f.nonCovered.toLocaleString("en-GB")} of tax identified as non-covered against ${f.currentTax.toLocaleString("en-GB")} of current tax. The amount is labelled in the mapping but is not removed from Adjusted Covered Taxes.`,
      missing: "Confirmation of the legal character of each item, and a posting that removes it from the numerator if it is not a Covered Tax.",
      amount: f.nonCovered,
      ...base(e),
      ruleId: "OECD-GloBE-15",
      article: "Art. 4.2.2",
      owner: "Local Tax",
      dept: "Tax",
      sourceDoc: "Tax provision workpaper",
      evidence: ["Tax return", "Tax-provision workpaper"],
      questions: [
        {
          id: `ct-nc-${e.id}-kind`,
          prompt: "Legal character of the amount",
          dept: "Tax",
          options: [
            { value: "non-covered", label: "Not a Covered Tax — turnover, payroll or property based" },
            { value: "covered", label: "A Covered Tax on income or profits after all" },
            { value: "uncertain", label: "Uncertain tax position rather than a settled charge" },
          ],
        },
        yesNo(`ct-nc-${e.id}-paid`, "Was the amount paid within three years of the end of the Fiscal Year?", "Tax", "Yes — paid within three years", "No — unpaid beyond three years"),
      ],
      branches: [
        {
          value: "non-covered",
          label: "Not a Covered Tax",
          treatment: "The amount leaves Adjusted Covered Taxes. The ETR falls and top-up tax rises — this is the exposure the label is currently hiding.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -f.nonCovered,
          sbieDelta: 0,
        },
        {
          value: "covered",
          label: "A Covered Tax",
          treatment: "The amount is a tax on income or profits and stays in the numerator. The mapping label must be corrected so the trail matches the treatment.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "uncertain",
          label: "Uncertain tax position",
          treatment: "An accrual for an uncertain tax position is excluded from Covered Taxes until paid, then picked up in the year of payment.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -f.nonCovered,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${e.code} identifies ${f.nonCovered.toLocaleString("en-GB")} of non-covered tax yet the effective tax rate numerator does not appear to exclude it. Reconcile the tax charge in the return to Adjusted Covered Taxes line by line.`,
      href: "/covered-taxes",
    });
  }

  for (const f of FINANCIALS.filter((x) => x.currentTax < 0)) {
    const e = ent(f.entityId);
    if (!e) continue;
    const amount = Math.abs(f.currentTax);
    out.push({
      id: `XR-CT-NEG-${e.id}`,
      engine: "covered",
      area: "Covered taxes",
      severity: "material",
      title: "Negative current tax drives the negative-tax machinery",
      detected: `${e.code} reports current tax of ${f.currentTax.toLocaleString("en-GB")} against GloBE income of ${f.fanil.toLocaleString("en-GB")}. A negative Adjusted Covered Taxes figure triggers either Excess Negative Tax Expense or Additional Current Top-up Tax, so its composition changes the result materially.`,
      missing: "Whether the credit is a loss carry-back, a refund of prior-year tax, a prior-year adjustment or a genuine current-year credit — and whether it is a Covered Tax at all.",
      amount,
      ...base(e),
      ruleId: f.fanil > 0 ? "OECD-ENTE-521" : "OECD-ACTTT-415",
      article: f.fanil > 0 ? "Art. 5.2.1 · Excess Negative Tax Expense" : "Art. 4.1.5",
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: "Tax provision workpaper",
      evidence: ["Tax return", "Tax-provision workpaper", "Deferred-tax schedule"],
      questions: [
        {
          id: `ct-neg-${e.id}-source`,
          prompt: "Source of the tax credit",
          dept: "Tax",
          options: [
            { value: "carryback", label: "Loss carry-back against prior-year profits" },
            { value: "prior-year", label: "Prior-year adjustment or refund" },
            { value: "current", label: "Current-year credit under local law" },
          ],
        },
        yesNo(`ct-neg-${e.id}-covered`, "Is the credit a Covered Tax under Art. 4.2?", "Tax", "Yes — a Covered Tax", "No — outside Art. 4.2"),
        {
          id: `ct-neg-${e.id}-period`,
          prompt: "Fiscal Year the prior-year item belongs to",
          dept: "Tax",
          options: [
            { value: "immaterial", label: "Immaterial — post in the current year under Art. 4.6.1" },
            { value: "material", label: "Material — restate the earlier year" },
          ],
          dependsOn: { questionId: `ct-neg-${e.id}-source`, value: "prior-year" },
        },
      ],
      branches: [
        {
          value: "carryback",
          label: "Loss carry-back",
          treatment: "A carry-back credit is a Covered Tax of the current year. The negative figure stands and flows through the negative-tax machinery as currently calculated.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "prior-year",
          label: "Prior-year adjustment",
          treatment: "A material prior-year item is taken back to the year it belongs to rather than depressing this year's numerator, which removes the negative-tax outcome here.",
          globeIncomeDelta: 0,
          coveredTaxDelta: amount,
          sbieDelta: 0,
        },
        {
          value: "current",
          label: "Current-year credit",
          treatment: "A current-year credit that is not a Covered Tax leaves the numerator entirely, so the negative figure disappears and the ETR is recomputed on the remaining tax.",
          globeIncomeDelta: 0,
          coveredTaxDelta: amount,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${e.code} reports negative current tax of ${f.currentTax.toLocaleString("en-GB")}. Identify the statutory basis for the credit and the year it relates to, and show why it belongs in this year's Adjusted Covered Taxes.`,
      href: "/covered-taxes",
    });
  }

  for (const a of ADJUSTMENTS.filter((x) => x.category === "Excluded dividends")) {
    const e = ent(a.entityId);
    if (!e) continue;
    out.push({
      id: `XR-CT-SYM-${a.id}`,
      engine: "covered",
      area: "Covered taxes",
      severity: "significant",
      title: "Tax attaching to excluded income not identified",
      detected: `${e.code} removes ${a.original.toLocaleString("en-GB")} of dividend income from GloBE income under ${a.ruleId}, but no matching reduction of current, deferred or withholding tax has been posted against it.`,
      missing: "The current tax, deferred tax and withholding tax attributable to the excluded income, so the tax leaves with the income it belongs to.",
      amount: money(a.original * 0.15),
      ...base(e),
      ruleId: "OECD-GloBE-15",
      article: "Art. 4.1.3",
      owner: a.preparer,
      dept: "Tax",
      sourceDoc: a.sourceDoc,
      evidence: ["Tax-provision workpaper", "Dividend voucher", "Tax return"],
      questions: [
        {
          id: `ct-sym-${a.id}-tax`,
          prompt: "Tax attaching to the excluded dividend",
          dept: "Tax",
          options: [
            { value: "none", label: "No tax attaches — exempt in the recipient jurisdiction" },
            { value: "wht", label: "Withholding tax suffered at source" },
            { value: "current", label: "Current tax borne on the receipt" },
          ],
        },
        yesNo(`ct-sym-${a.id}-deferred`, "Is any deferred tax recognised on the excluded income?", "Tax", "Yes — deferred tax recognised", "No deferred tax"),
      ],
      branches: [
        {
          value: "none",
          label: "No attaching tax",
          treatment: "Income out with no tax to follow it. Numerator and denominator stay symmetric as calculated.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "wht",
          label: "Withholding tax suffered",
          treatment: "Withholding tax on income excluded from GloBE income must come out of Adjusted Covered Taxes with it, which lowers the ETR.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -money(a.original * 0.1),
          sbieDelta: 0,
        },
        {
          value: "current",
          label: "Current tax borne",
          treatment: "Current tax on the excluded receipt leaves the numerator so the same income is not relieved twice.",
          globeIncomeDelta: 0,
          coveredTaxDelta: -money(a.original * 0.15),
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${e.code} excludes ${a.original.toLocaleString("en-GB")} of dividend income while retaining the full tax charge in the numerator. Identify every current, deferred, withholding and controlled foreign company tax attaching to that income.`,
      href: "/covered-taxes",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 7 · Entity & Ownership Classification
// ---------------------------------------------------------------------------

/**
 * The legal-entity type on a register is not the GloBE test. Transparency,
 * investment entity status, joint venture status and statelessness each decide
 * which jurisdiction owns a result and which blend it lands in — and each turns
 * on facts held outside the accounting system.
 */
export function entityXray(): XrayFinding[] {
  const targets = ENTITIES.filter(
    (e) =>
      e.type === "Tax-transparent"
      || e.type === "Stateless"
      || e.type === "Investment"
      || (e.equityMethod === true)
      || e.completeness < 80,
  );

  return targets.map((e) => {
    const f = fin(e.id);
    const amount = Math.abs(f?.fanil ?? 0);
    const cls = classFor(e.id);
    const questions: XrayQuestion[] = [
      {
        id: `ent-${e.id}-test`,
        prompt: "Confirmed GloBE classification",
        dept: "Legal",
        options: [
          { value: "as-calculated", label: `As calculated — ${cls.blendKind === "main" ? "ordinary Constituent Entity blend" : cls.blendKind.toUpperCase()}` },
          { value: "transparent", label: "Tax-transparent — income flows to the owners" },
          { value: "reverse-hybrid", label: "Reverse hybrid — income stays with the entity" },
          { value: "excluded", label: "Excluded Entity — outside the GloBE calculation" },
        ],
      },
      {
        id: `ent-${e.id}-situs`,
        prompt: "Jurisdiction that owns the result",
        dept: "Legal",
        options: [
          { value: "as-registered", label: `As registered — ${e.jurisdiction}` },
          { value: "dual", label: "Dual resident — treaty tie-breaker needed" },
          { value: "stateless", label: "Stateless — no jurisdiction of residence" },
        ],
      },
      yesNo(`ent-${e.id}-pe`, "Does the entity have a permanent establishment in another jurisdiction?", "Legal", "Yes — permanent establishment exists", "No permanent establishment"),
      {
        id: `ent-${e.id}-docs`,
        prompt: "Constitutional and ownership documents supporting the classification",
        dept: "Legal",
        options: [
          { value: "held", label: "Held and current" },
          { value: "missing", label: "Not on file" },
        ],
      },
    ];
    return {
      id: `XR-ENT-${e.id}`,
      engine: "entity" as const,
      area: "Entity & ownership" as const,
      severity: sev(amount, e.type === "Tax-transparent" || e.type === "Stateless" ? "significant" : undefined),
      title: `${e.type} classification rests on facts outside the accounts`,
      detected: `${e.code} is registered as ${e.type} with ${e.ownership}% direct ownership and data completeness of ${e.completeness}%. The engine currently blends it as ${cls.blendKind === "main" ? "an ordinary Constituent Entity" : cls.blendKind.toUpperCase()} carrying ${amount.toLocaleString("en-GB")} of financial accounting net income.`,
      missing: "Constitutional documents, tax residence and transparency status, and whether any permanent establishment moves part of the result to another jurisdiction.",
      amount,
      ...base(e),
      ruleId: "OECD-ENTITY-TEST",
      article: "Art. 10.1 / 10.3",
      owner: "Group Tax",
      dept: "Legal" as const,
      sourceDoc: "Aetherion_Legal_Entity_List_FY2026.xlsx",
      evidence: ["Corporate structure document", "Tax return"] as EvidenceKind[],
      questions,
      branches: [
        {
          value: "as-calculated",
          label: "As calculated",
          treatment: "The classification in the engine is confirmed. The entity stays in its current blend and jurisdiction.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "transparent",
          label: "Tax-transparent",
          treatment: "Financial accounting net income is allocated to the owners, so it leaves this jurisdiction's blend entirely.",
          globeIncomeDelta: -(f?.fanil ?? 0),
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "reverse-hybrid",
          label: "Reverse hybrid",
          treatment: "Income stays with the entity rather than flowing to the owners, so the result remains in this jurisdiction and the owner's blend is reduced.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "excluded",
          label: "Excluded Entity",
          treatment: "An Excluded Entity drops out of the GloBE calculation altogether, along with its income, taxes and substance.",
          globeIncomeDelta: -(f?.fanil ?? 0),
          coveredTaxDelta: -(f?.currentTax ?? 0),
          sbieDelta: 0,
        },
      ],
      rdChallenge: `Produce the constitutional documents and tax residence evidence for ${e.code}, and confirm its transparency status and any permanent establishment. The register label alone does not establish the GloBE classification.`,
      href: "/entities",
    };
  });
}

// ---------------------------------------------------------------------------
// 8 · Election & Historical Attribute Check
// ---------------------------------------------------------------------------

/**
 * Elections carry legal characteristics the toggle cannot show: who was entitled
 * to make it, the scope it binds, whether it is locked for five years, and the
 * filing evidence proving it was made. Historical attributes carried in from the
 * prior return set the vintages those tests run against.
 */
export function electionXray(electionsOn: Record<string, boolean> = {}): XrayFinding[] {
  const out: XrayFinding[] = [];
  const upe = ENTITIES.find((e) => e.type === "UPE")!;

  const priorGir = FILES.find((f) => f.kind === "Previous GIR");
  if (priorGir && priorGir.status !== "Validated" && priorGir.status !== "Reviewed") {
    out.push({
      id: "XR-EL-PRIOR",
      engine: "election",
      area: "Elections",
      severity: "material",
      title: "Prior-year return not validated — election vintages unproven",
      detected: `${priorGir.name} is loaded at status "${priorGir.status}". Election first-election years, safe-harbour history, deferred tax vintages and negative-tax carry-forwards all come from this return.`,
      missing: "Validated prior-year attributes: which elections were first made and when, safe-harbour outcomes, and the carry-forward balances brought into this Fiscal Year.",
      amount: 0,
      entityId: upe.id,
      entityCode: upe.code,
      entityName: upe.name,
      iso: upe.iso,
      jurisdiction: upe.jurisdiction,
      ruleId: "OECD-GloBE-15",
      article: "Art. 8.1 · historical attributes",
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: priorGir.name,
      evidence: ["Tax return", "Corporate structure document"],
      questions: [
        {
          id: "el-prior-state",
          prompt: "Status of the prior-year return reconciliation",
          dept: "Tax",
          options: [
            { value: "reconciled", label: "Reconciled — vintages and carry-forwards agreed" },
            { value: "partial", label: "Partly reconciled — some attributes unconfirmed" },
            { value: "none", label: "Not reconciled" },
          ],
        },
        yesNo("el-prior-harbour", "Was a Transitional CbCR Safe Harbour used in any jurisdiction last year?", "Tax", "Yes — harbour used", "No — harbour not used"),
        {
          id: "el-prior-locks",
          prompt: "Five-year election locks running from an earlier year",
          dept: "Tax",
          options: [
            { value: "documented", label: "Documented with first-election years" },
            { value: "unknown", label: "First-election years not documented" },
          ],
        },
      ],
      branches: [
        {
          value: "reconciled",
          label: "Reconciled",
          treatment: "Vintages, harbour continuity and carry-forwards are established, so the consistency tests can run against real history.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "partial",
          label: "Partly reconciled",
          treatment: "Unconfirmed attributes leave the five-year lock and once-out-always-out tests running on assumptions rather than the filed position.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "none",
          label: "Not reconciled",
          treatment: "Without the prior return neither election locks nor harbour continuity can be evidenced, and any carried deferred tax vintage is unsupported.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
      ],
      rdChallenge: "Produce the filed prior-year return and reconcile every carried attribute to it: election first-election years, safe-harbour outcomes, deferred tax vintages and negative-tax carry-forwards.",
      href: "/years",
    });
  }

  const tp = FILES.find((f) => f.kind === "TP report");
  if (tp && tp.status === "Imported") {
    out.push({
      id: "XR-EL-TP",
      engine: "election",
      area: "Elections",
      severity: "significant",
      title: "Arm's-length support not validated for cross-border adjustments",
      detected: `${tp.name} is loaded at status "${tp.status}". Art. 3.2.4 requires cross-border transactions between Constituent Entities to be recorded consistently and at arm's length in both jurisdictions.`,
      missing: "Validated transfer pricing support for the intra-group charges adjusted in GloBE income, and confirmation the same amount is recognised on both sides.",
      amount: 0,
      entityId: upe.id,
      entityCode: upe.code,
      entityName: upe.name,
      iso: upe.iso,
      jurisdiction: upe.jurisdiction,
      ruleId: "OECD-GloBE-15",
      article: "Art. 3.2.4",
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: tp.name,
      evidence: ["Corporate structure document", "Tax return"],
      questions: [
        {
          id: "el-tp-state",
          prompt: "Consistency of intra-group pricing across the two jurisdictions",
          dept: "Tax",
          options: [
            { value: "symmetric", label: "Same amount recognised on both sides" },
            { value: "asymmetric", label: "Amounts differ between the jurisdictions" },
          ],
        },
        yesNo("el-tp-adjust", "Has any jurisdiction made a unilateral transfer pricing adjustment?", "Tax", "Yes — unilateral adjustment made", "No adjustments"),
      ],
      branches: [
        {
          value: "symmetric",
          label: "Symmetric",
          treatment: "Art. 3.2.4 is satisfied where the same arm's-length amount is recognised in both jurisdictions.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "asymmetric",
          label: "Asymmetric",
          treatment: "An asymmetric charge must be trued up to a consistent arm's-length amount in both jurisdictions before GloBE income is final.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
      ],
      rdChallenge: "Produce validated transfer pricing documentation for the intra-group charges adjusted in GloBE income, and show the same arm's-length amount is recognised in the counterparty jurisdiction.",
      href: "/globe-income",
    });
  }

  for (const key of Object.keys(electionsOn).filter((k) => electionsOn[k])) {
    const [id, iso] = key.split("@");
    const def = electionById(id);
    if (!def) continue;
    const e = ENTITIES.find((x) => x.iso === iso) ?? upe;
    out.push({
      id: `XR-EL-${key}`,
      engine: "election",
      area: "Elections",
      severity: def.duration === "five-year" ? "material" : "significant",
      title: `Election made without authority or filing evidence on file`,
      detected: `${def.article} is elected for ${e.jurisdiction} at ${def.scope} scope with ${def.duration} duration. No record identifies who was entitled to make it or evidences that it was reported in the return.`,
      missing: "The entity with authority to make the election, the approval that authorised it, and the filing evidence proving it was reported.",
      amount: 0,
      ...base(e),
      ruleId: "OECD-GloBE-15",
      article: def.article,
      owner: "Group Tax",
      dept: "Tax",
      sourceDoc: "Election register",
      evidence: ["Tax return", "Corporate structure document"],
      questions: [
        {
          id: `el-${key}-authority`,
          prompt: "Entity that made the election",
          dept: "Tax",
          options: [
            { value: "filer", label: "Filing Constituent Entity" },
            { value: "local", label: "Designated Local Entity" },
            { value: "unknown", label: "Not recorded" },
          ],
        },
        {
          id: `el-${key}-scope`,
          prompt: `Scope actually applied against the ${def.scope} scope this election requires`,
          dept: "Tax",
          options: [
            { value: "match", label: "Matches the required scope" },
            { value: "mismatch", label: "Applied at a different scope" },
          ],
        },
        {
          id: `el-${key}-evidence`,
          prompt: "Filing evidence that the election was reported",
          dept: "Tax",
          options: [
            { value: "filed", label: "Reported in the return — evidence held" },
            { value: "pending", label: "Not yet reported" },
          ],
        },
      ],
      branches: [
        {
          value: "filer",
          label: "Filing Constituent Entity",
          treatment: "The election was made by the entity entitled to make it. Attach the filing evidence to close the item.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "local",
          label: "Designated Local Entity",
          treatment: "A Designated Local Entity may make the election only where local law permits it for this election type. Confirm the designation is in force.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
        {
          value: "unknown",
          label: "Not recorded",
          treatment: "An election with no identified maker cannot be relied on. Until authority and filing evidence exist the calculation should be run without it.",
          globeIncomeDelta: 0,
          coveredTaxDelta: 0,
          sbieDelta: 0,
        },
      ],
      rdChallenge: `${def.article} is claimed for ${e.jurisdiction}. Identify the entity that made the election, its authority to do so, and the return in which it was reported.`,
      href: "/elections",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export type XrayScanCtx = { electionsOn?: Record<string, boolean> };

const CACHE = new Map<string, XrayFinding[]>();

/**
 * Run every detection engine. Deterministic for a given election context, and
 * cached because the detectors walk the deferred-tax register.
 */
export function runXray(ctx: XrayScanCtx = {}): XrayFinding[] {
  const on = ctx.electionsOn ?? {};
  const key = Object.keys(on).filter((k) => on[k]).sort().join("|");
  const hit = CACHE.get(key);
  if (hit) return hit;
  const findings = [
    ...dividendXray(),
    ...payrollXray(),
    ...assetXray(),
    ...boiXray(),
    ...deferredXray(),
    ...coveredXray(),
    ...entityXray(),
    ...electionXray(on),
  ];
  CACHE.set(key, findings);
  return findings;
}
