/** OECD GloBE election master matrix. Scope is architectural: a JURISDICTION election cannot be flipped for one CE. */

export const OECD_ELEC_URLS = {
  commentary:
    "https://www.oecd.org/en/publications/tax-challenges-arising-from-the-digitalisation-of-the-economy-consolidated-commentary-to-the-global-anti-base-erosion-model-rules-2026_4377e89f-en.html",
  modelRules:
    "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/global-anti-base-erosion-model-rules-pillar-two.html",
  gir: "https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/01/tax-challenges-arising-from-the-digitalisation-of-the-economy-globe-information-return-january-2025_b03274ed/a05ec99a-en.pdf",
  girXml:
    "https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/01/globe-information-return-pillar-two-xml-schema_3980638f/c594935a-en.pdf",
  sbs: "https://www.oecd.org/content/dam/oecd/en/topics/policy-sub-issues/global-minimum-tax/side-by-side-package.pdf",
  central:
    "https://www.oecd.org/en/topics/sub-issues/global-minimum-tax/central-record-of-legislation-with-transitional-qualified-status.html",
};

export type ElectionFamily = "globe" | "harbour" | "setr";
export type ElectionScope =
  | "GROUP"
  | "UPE_JURISDICTION"
  | "JURISDICTION"
  | "JURISDICTION_YEAR"
  | "CONSTITUENT_ENTITY"
  | "OWNER_INVESTMENT_ENTITY"
  | "TRANSACTION"
  | "ASSET_CLASS"
  | "DTL_ITEM"
  | "GL_ACCOUNT"
  | "ALL_JURISDICTIONS";
export type ElectionDuration = "annual" | "five-year" | "first-gir" | "transaction" | "conditional";
export type GirLevel = "group" | "jurisdictional" | "ce";

export type ElectionDef = {
  id: string;
  n: string;
  family: ElectionFamily;
  name: string;
  article: string;
  scope: ElectionScope;
  duration: ElectionDuration;
  gir: GirLevel;
  girField: string;
  defaultTx: string;
  electedTx: string;
  consistency: string;
  revocable: boolean;
  reelect: "yes" | "no" | "restricted";
  qdmtt: string;
  impact: string;
  href: string;
};

export const DURATION_LABEL: Record<ElectionDuration, string> = {
  annual: "Annual",
  "five-year": "Five-year lock",
  "first-gir": "First GIR for the jurisdiction",
  transaction: "Transaction",
  conditional: "Conditional",
};

export const SCOPE_LABEL: Record<ElectionScope, string> = {
  GROUP: "Group",
  UPE_JURISDICTION: "UPE jurisdiction",
  JURISDICTION: "Jurisdiction — all CEs",
  JURISDICTION_YEAR: "Jurisdiction / year",
  CONSTITUENT_ENTITY: "Constituent entity",
  OWNER_INVESTMENT_ENTITY: "Owner + investment entity",
  TRANSACTION: "Transaction",
  ASSET_CLASS: "Asset class",
  DTL_ITEM: "DTL item",
  GL_ACCOUNT: "GL account / DTL category",
  ALL_JURISDICTIONS: "All jurisdictions",
};

export const ELECTIONS: ElectionDef[] = [
  { id: "OECD_1.5.3", n: "01", family: "globe", name: "Opt an otherwise Excluded Entity into GloBE", article: "Art. 1.5.3", scope: "CONSTITUENT_ENTITY", duration: "five-year", gir: "ce", girField: "Excluded Entity election", defaultTx: "Entity excluded from GloBE", electedTx: "Entity included as a CE", consistency: "CE for five years", revocable: true, reelect: "restricted", qdmtt: "Follows GloBE inclusion", impact: "Blending set changes", href: "/entities" },
  { id: "OECD_3.2.1b", n: "02", family: "globe", name: "Portfolio Shareholding Dividend Election", article: "Art. 3.2.1(b)", scope: "CONSTITUENT_ENTITY", duration: "five-year", gir: "ce", girField: "Portfolio dividend election", defaultTx: "Include portfolio dividends in GloBE", electedTx: "Exclude qualifying portfolio dividends", consistency: "CE / 5-year", revocable: true, reelect: "restricted", qdmtt: "Same income definition if QDMTT follows GloBE", impact: "GloBE income ↓ if elected", href: "/globe-income" },
  { id: "OECD_3.2.1c_fx", n: "03", family: "globe", name: "FX Hedge / Net Investment Hedge Election", article: "Art. 3.2.1(c)", scope: "CONSTITUENT_ENTITY", duration: "five-year", gir: "ce", girField: "FX hedge election", defaultTx: "Hedge gain/loss follows Excluded Equity Gain/Loss", electedTx: "Include qualifying hedge in GloBE", consistency: "CE / 5-year", revocable: true, reelect: "restricted", qdmtt: "Same", impact: "GloBE income volatility", href: "/globe-income" },
  { id: "OECD_3.2.1_debt", n: "04", family: "globe", name: "Debt Release Election", article: "Art. 3.2.1 + AG", scope: "CONSTITUENT_ENTITY", duration: "annual", gir: "ce", girField: "Debt release election", defaultTx: "Accounting debt-release income in GloBE", electedTx: "Qualifying GloBE adjustment", consistency: "CE / year", revocable: true, reelect: "yes", qdmtt: "Same year", impact: "One-off income", href: "/globe-income" },
  { id: "OECD_3.2.1c_eq", n: "05", family: "globe", name: "Equity Investment Inclusion Election", article: "Art. 3.2.1(c)", scope: "JURISDICTION", duration: "five-year", gir: "jurisdictional", girField: "Equity investment inclusion", defaultTx: "Exclude equity gains/losses", electedTx: "Include qualifying equity gains/losses and related taxes", consistency: "All CEs in the jurisdiction", revocable: true, reelect: "restricted", qdmtt: "Jurisdictional", impact: "Income and covered taxes move together", href: "/globe-income" },
  { id: "OECD_3.2.2", n: "06", family: "globe", name: "Stock-Based Compensation Election", article: "Art. 3.2.2", scope: "JURISDICTION", duration: "five-year", gir: "jurisdictional", girField: "Stock-based compensation election", defaultTx: "Financial accounting stock-comp expense", electedTx: "Local tax deduction substituted into GloBE Income", consistency: "ALL Constituent Entities located in that jurisdiction — not entity-by-entity", revocable: true, reelect: "restricted", qdmtt: "Same income if QDMTT uses GloBE", impact: "GloBE income uses tax deduction; ETR can rise when tax deduction > book", href: "/elections" },
  { id: "OECD_3.2.5", n: "07", family: "globe", name: "Realisation Principle Election", article: "Art. 3.2.5", scope: "ASSET_CLASS", duration: "five-year", gir: "jurisdictional", girField: "Realisation principle election", defaultTx: "Fair-value / impairment accounting", electedTx: "Realised gain/loss only (may be limited to tangible assets or Investment Entities)", consistency: "Jurisdiction; asset-class variants allowed", revocable: true, reelect: "restricted", qdmtt: "Same", impact: "Defers unrealised amounts out of GloBE", href: "/globe-income" },
  { id: "OECD_3.2.6", n: "08", family: "globe", name: "Aggregate Asset Gain Election", article: "Art. 3.2.6", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Aggregate asset gain election", defaultTx: "Current-year gain recognition", electedTx: "Special spreading / offset mechanism", consistency: "Jurisdiction / year", revocable: true, reelect: "yes", qdmtt: "Annual", impact: "Timing of asset gains", href: "/globe-income" },
  { id: "OECD_3.2.8", n: "09", family: "globe", name: "Intra-group Transaction Election", article: "Art. 3.2.8", scope: "JURISDICTION", duration: "five-year", gir: "jurisdictional", girField: "Intra-group transaction election", defaultTx: "Separate-entity accounting", electedTx: "Consolidated treatment for same-jurisdiction CEs", consistency: "All same-jurisdiction CEs", revocable: true, reelect: "restricted", qdmtt: "Blending already jurisdictional", impact: "Eliminates intra-Thai/intra-IE noise", href: "/globe-income" },
  { id: "OECD_4.1.5", n: "10", family: "globe", name: "Negative Tax Expense Carry-forward", article: "Art. 4.1.5", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Negative tax expense carry-forward", defaultTx: "Immediate effect on top-up calculation", electedTx: "Carry-forward of negative tax expense", consistency: "Jurisdiction / year", revocable: true, reelect: "yes", qdmtt: "Covered-tax timing", impact: "Covered taxes timing", href: "/covered-taxes" },
  { id: "OECD_4.4.7_a", n: "11", family: "globe", name: "Unclaimed Accrual Election — annual", article: "Art. 4.4.7", scope: "DTL_ITEM", duration: "annual", gir: "ce", girField: "Unclaimed accrual (annual)", defaultTx: "Include deferred-tax accrual in Adjusted Covered Taxes", electedTx: "Exclude the DTL/item from Adjusted Covered Taxes", consistency: "Item / GL / year", revocable: true, reelect: "yes", qdmtt: "DT numerator", impact: "Avoids later recapture on selected items", href: "/deferred-tax" },
  { id: "OECD_4.4.7_5", n: "12", family: "globe", name: "Unclaimed Accrual Election — five-year", article: "Art. 4.4.7 + AG", scope: "GL_ACCOUNT", duration: "five-year", gir: "ce", girField: "Unclaimed accrual (five-year category)", defaultTx: "Apply DTL recapture rules to the category", electedTx: "Exclude the whole GL / Aggregate DTL category", consistency: "GL account or Aggregate DTL Category for five years", revocable: true, reelect: "restricted", qdmtt: "DT numerator", impact: "Category-level recapture off", href: "/deferred-tax" },
  { id: "OECD_4_nbdt", n: "13", family: "globe", name: "No Cross-Border Deferred Tax Allocation Election", article: "Commentary to Ch. 4", scope: "JURISDICTION", duration: "five-year", gir: "jurisdictional", girField: "No cross-border DT allocation", defaultTx: "Allocate qualifying deferred tax across jurisdictions", electedTx: "Leave deferred tax with the originating entity", consistency: "Jurisdiction / 5-year", revocable: true, reelect: "restricted", qdmtt: "Local DT only", impact: "PE / main-entity DT split", href: "/deferred-tax" },
  { id: "OECD_4.5", n: "14", family: "globe", name: "GloBE Loss Election", article: "Art. 4.5", scope: "JURISDICTION", duration: "first-gir", gir: "jurisdictional", girField: "GloBE Loss Election", defaultTx: "Normal Art. 4.4 deferred-tax method", electedTx: "Special deemed GloBE Loss DTA in lieu of Art. 4.4", consistency: "First GIR for the jurisdiction. Revocable YES. Re-elect after revocation: NO (GIR XML).", revocable: true, reelect: "no", qdmtt: "Often mirrored if QDMTT follows GloBE DT", impact: "Replaces recast/recapture mechanics", href: "/deferred-tax" },
  { id: "OECD_4.6.1", n: "15", family: "globe", name: "Immaterial Decrease in Covered Taxes Election", article: "Art. 4.6.1", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Immaterial decrease election", defaultTx: "Recalculate prior-year ETR", electedTx: "Recognise the adjustment in the current year", consistency: "Jurisdiction / year", revocable: true, reelect: "yes", qdmtt: "Prior-year vs current", impact: "Avoids reopening origin-year ETR for small amounts", href: "/covered-taxes" },
  { id: "OECD_5.3.1", n: "16", family: "globe", name: "SBIE opt-out / claim", article: "Art. 5.3.1", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "SBIE election (not to apply)", defaultTx: "Claim Substance-based Income Exclusion (model max / partial / none)", electedTx: "Do not apply SBIE this year", consistency: "Annual; not a 5-year lock. Amount claimed can be less than the maximum.", revocable: true, reelect: "yes", qdmtt: "Excess profit", impact: "Excess Profit and top-up; ETR itself does not change", href: "/sbie" },
  { id: "OECD_5.5", n: "17", family: "globe", name: "De Minimis Exclusion", article: "Art. 5.5", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "De minimis exclusion", defaultTx: "Normal ETR / top-up calculation", electedTx: "Top-up Tax deemed zero if revenue and profit tests met", consistency: "Jurisdiction / year · conditions must hold", revocable: true, reelect: "yes", qdmtt: "May still collect if domestic de minimis differs", impact: "Zeros top-up when eligible", href: "/safe-harbours" },
  { id: "OECD_6.3.4", n: "18", family: "globe", name: "Fair-value / tax-basis alignment election", article: "Art. 6.3.4", scope: "TRANSACTION", duration: "transaction", gir: "ce", girField: "Art. 6.3.4 election", defaultTx: "Historical GloBE carrying value", electedTx: "Recognised fair-value / tax-basis adjustment", consistency: "CE / triggering transfer", revocable: false, reelect: "restricted", qdmtt: "Transaction year", impact: "GloBE basis step-up or down", href: "/globe-income" },
  { id: "OECD_6.3.4c", n: "19", family: "globe", name: "Timing of Art. 6.3.4 gain/loss", article: "Art. 6.3.4(c)", scope: "TRANSACTION", duration: "transaction", gir: "ce", girField: "Art. 6.3.4(c) timing", defaultTx: "Recognise entirely in the triggering year", electedTx: "Spread over five years", consistency: "That transfer", revocable: false, reelect: "restricted", qdmtt: "Spread vs spike", impact: "Five-year income spread", href: "/globe-income" },
  { id: "OECD_7.3", n: "20", family: "globe", name: "Eligible Distribution Tax System Election", article: "Art. 7.3", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "EDTS election", defaultTx: "Ordinary GloBE tax treatment", electedTx: "Deemed Distribution Tax + recapture system", consistency: "Jurisdiction / year", revocable: true, reelect: "yes", qdmtt: "Rarely the Thai path", impact: "Distribution-tax jurisdictions only", href: "/covered-taxes" },
  { id: "OECD_7.5", n: "21", family: "globe", name: "Investment Entity Tax Transparency Election", article: "Art. 7.5", scope: "OWNER_INVESTMENT_ENTITY", duration: "five-year", gir: "ce", girField: "IE tax transparency election", defaultTx: "Separate Investment Entity ETR", electedTx: "Transparent treatment to owners", consistency: "Owner + IE / 5-year", revocable: true, reelect: "restricted", qdmtt: "Owner jurisdiction", impact: "Moves IE income into owner blending", href: "/entities" },
  { id: "OECD_7.6", n: "22", family: "globe", name: "Taxable Distribution Method Election", article: "Art. 7.6", scope: "OWNER_INVESTMENT_ENTITY", duration: "five-year", gir: "ce", girField: "Taxable distribution method", defaultTx: "Ordinary Investment Entity rules", electedTx: "Distribution-based taxation", consistency: "IE owner / 5-year", revocable: true, reelect: "restricted", qdmtt: "Owner", impact: "IE distributions vs entity ETR", href: "/entities" },
  { id: "OECD_QDMTT_FX", n: "23", family: "globe", name: "QDMTT currency election", article: "QDMTT AG", scope: "JURISDICTION", duration: "five-year", gir: "jurisdictional", girField: "QDMTT currency", defaultTx: "Local currency of the QDMTT", electedTx: "CFS presentation currency (where the AG permits)", consistency: "Generally 5-year", revocable: true, reelect: "restricted", qdmtt: "Defines the QDMTT currency of computation", impact: "Thai QDMTT is THB; Core remains USD", href: "/thailand/fx" },
  { id: "OECD_3.1.3", n: "24", family: "globe", name: "Alternative accounting standard under Art. 3.1.3", article: "Art. 3.1.3", scope: "CONSTITUENT_ENTITY", duration: "conditional", gir: "ce", girField: "Accounting standard", defaultTx: "UPE Acceptable Financial Accounting Standard", electedTx: "Qualifying local / other standard with material-difference tests", consistency: "CE / conditional", revocable: true, reelect: "restricted", qdmtt: "FANIL source", impact: "FANIL starting point", href: "/fx" },
  { id: "OECD_3.3", n: "24b", family: "globe", name: "International Shipping Income exclusion", article: "Art. 3.3", scope: "CONSTITUENT_ENTITY", duration: "annual", gir: "ce", girField: "International shipping exclusion", defaultTx: "Shipping income remains in GloBE Income", electedTx: "Exclude QISI + QAISI (50% of QISI cap) when Art. 3.3.4 management tests pass; exclude attributable Covered Taxes", consistency: "CE / year · management evidence required", revocable: true, reelect: "yes", qdmtt: "Same income definition if QDMTT follows GloBE", impact: "GloBE income and Covered Taxes ↓ for shipping CEs", href: "/globe-income" },
  { id: "OECD_9.1.3", n: "25", family: "globe", name: "Transition asset carrying-value treatment", article: "Art. 9.1.3", scope: "TRANSACTION", duration: "conditional", gir: "ce", girField: "Transition carrying value", defaultTx: "Transferee carrying value treatment", electedTx: "Transferor historical basis / deemed DTA treatment", consistency: "Transition transfer", revocable: false, reelect: "restricted", qdmtt: "Opening GloBE basis", impact: "Transition-year basis", href: "/deferred-tax" },

  { id: "SH_TCSH", n: "H1", family: "harbour", name: "Transitional CbCR Safe Harbour", article: "Art. 8.1 / OECD-TCSH-2026", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Safe harbour election (identify the test used)", defaultTx: "Full GloBE calculation", electedTx: "Top-up deemed zero if de minimis, simplified ETR or routine profits passes", consistency: "If more than one qualifying test, GIR requires the MNE to identify the test elected", revocable: true, reelect: "yes", qdmtt: "Does not replace a qualified QDMTT", impact: "Zeros IIR/UTPR path for the year", href: "/safe-harbours" },
  { id: "SH_TCSH_DM", n: "H1a", family: "harbour", name: "TCSH — de minimis test", article: "Art. 8.1.1", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "De minimis test", defaultTx: "Full calculation", electedTx: "Test #1 of Transitional CbCR", consistency: "Year", revocable: true, reelect: "yes", qdmtt: "n/a", impact: "Harbour if both revenue and profit thresholds met", href: "/safe-harbours" },
  { id: "SH_TCSH_ETR", n: "H1b", family: "harbour", name: "TCSH — simplified ETR test", article: "Art. 8.1.2", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Simplified ETR test", defaultTx: "Full calculation", electedTx: "Test #2 · 17% for FY2026/27", consistency: "Year", revocable: true, reelect: "yes", qdmtt: "n/a", impact: "Harbour if CbCR simplified ETR ≥ rate", href: "/safe-harbours" },
  { id: "SH_TCSH_RP", n: "H1c", family: "harbour", name: "TCSH — routine profits test", article: "Art. 8.1.3", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Routine profits test", defaultTx: "Full calculation", electedTx: "Test #3", consistency: "Year", revocable: true, reelect: "yes", qdmtt: "n/a", impact: "Harbour if profit ≤ routine-profits amount", href: "/safe-harbours" },
  { id: "SH_SCSH", n: "H2", family: "harbour", name: "Simplified Calculations Safe Harbour", article: "Permanent SH annex", scope: "JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "Simplified calculations SH", defaultTx: "Full GloBE", electedTx: "Simplified calculation path", consistency: "Jurisdiction", revocable: true, reelect: "yes", qdmtt: "Separate from QDMTT SH", impact: "Reduced data", href: "/safe-harbours" },
  { id: "SH_NMCE", n: "H3", family: "harbour", name: "NMCE Simplified Calculations", article: "NMCE SH", scope: "CONSTITUENT_ENTITY", duration: "annual", gir: "ce", girField: "NMCE simplified", defaultTx: "Full GloBE data", electedTx: "Simplified CbCR-based treatment for non-material CEs", consistency: "CE", revocable: true, reelect: "yes", qdmtt: "If QDMTT permits", impact: "Data burden", href: "/safe-harbours" },
  { id: "SH_QDMTT", n: "H4", family: "harbour", name: "QDMTT Safe Harbour", article: "QDMTT SH", scope: "JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "QDMTT safe harbour", defaultTx: "Full IIR/UTPR on residual", electedTx: "Rely on qualified domestic minimum tax (Central Record)", consistency: "Tied to OECD Central Record qualified status", revocable: true, reelect: "yes", qdmtt: "This IS the QDMTT path", impact: "Foreign IIR/UTPR deemed zero if qualified", href: "/allocation" },
  { id: "SH_UTPR", n: "H5", family: "harbour", name: "Transitional UTPR Safe Harbour", article: "UTPR SH", scope: "UPE_JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "Transitional UTPR SH", defaultTx: "UTPR applicable", electedTx: "UTPR deemed zero in the UPE jurisdiction", consistency: "UPE jurisdiction", revocable: true, reelect: "yes", qdmtt: "n/a", impact: "US path on this snapshot", href: "/safe-harbours" },
  { id: "SH_SETR", n: "H6", family: "harbour", name: "Simplified ETR Safe Harbour", article: "OECD-SETR-SH · 2026 package", scope: "JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "Simplified ETR SH", defaultTx: "Full GloBE calculation", electedTx: "Simplified 15% ETR calculation — itself contains further elections", consistency: "Tested jurisdiction. Inner elections may lock 5 years and survive a return to full GloBE.", revocable: true, reelect: "yes", qdmtt: "Does not replace Thai QDMTT", impact: "May zero top-up; see SETR inner elections", href: "/elections" },
  { id: "SH_SBTI", n: "H7", family: "harbour", name: "Substance-Based Tax Incentive Safe Harbour", article: "OECD-SBTISH · 2026 package", scope: "JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "SBTI SH", defaultTx: "Ordinary incentive treatment (holiday reduces covered taxes)", electedTx: "Qualified incentive treated as addition to covered taxes, subject to substance limits", consistency: "Jurisdiction · expenditure tracing required", revocable: true, reelect: "yes", qdmtt: "May preserve BOI value inside QDMTT", impact: "ETR support for substance-based incentives", href: "/safe-harbours" },
  { id: "SH_SBS", n: "H8", family: "harbour", name: "Side-by-Side Safe Harbour", article: "2026 Side-by-Side package", scope: "GROUP", duration: "annual", gir: "group", girField: "Side-by-Side SH", defaultTx: "IIR/UTPR apply", electedTx: "IIR/UTPR generally deemed zero for covered group operations", consistency: "Group / UPE path", revocable: true, reelect: "yes", qdmtt: "Domestic QDMTT still possible", impact: "US SbS on this snapshot", href: "/safe-harbours" },
  { id: "SH_UPE", n: "H9", family: "harbour", name: "UPE Safe Harbour", article: "UPE SH · 2026 package", scope: "UPE_JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "UPE safe harbour", defaultTx: "UTPR in UPE jurisdiction", electedTx: "Relief in the UPE jurisdiction", consistency: "UPE jurisdiction", revocable: true, reelect: "yes", qdmtt: "n/a", impact: "Japan UPE path", href: "/safe-harbours" },

  { id: "SETR_APPLY", n: "S0", family: "setr", name: "Apply Simplified ETR Safe Harbour", article: "SETR SH", scope: "JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "SETR applied", defaultTx: "Full GloBE", electedTx: "Simplified ETR route", consistency: "Tested jurisdiction", revocable: true, reelect: "yes", qdmtt: "Separate", impact: "Opens inner elections below", href: "/elections" },
  { id: "SETR_FX", n: "S1", family: "setr", name: "Asymmetric FX adjustment opt-out", article: "SETR / Art. 3.2.1(f)", scope: "GROUP", duration: "five-year", gir: "group", girField: "Asymmetric FX opt-out", defaultTx: "Make the Art. 3.2.1(f) adjustment", electedTx: "Do not make it — continues even if the group later returns to full GloBE", consistency: "Group / 5-year", revocable: true, reelect: "restricted", qdmtt: "Follows GloBE if later full calc", impact: "FX in Simplified Income", href: "/elections" },
  { id: "SETR_PEN", n: "S2", family: "setr", name: "Accrued pension adjustment opt-out", article: "SETR", scope: "GROUP", duration: "five-year", gir: "group", girField: "Pension opt-out", defaultTx: "Contributions-based adjustment", electedTx: "Keep accounting treatment — survives return to full GloBE", consistency: "Group / 5-year", revocable: true, reelect: "restricted", qdmtt: "Same", impact: "Pension in Simplified Income", href: "/elections" },
  { id: "SETR_INS", n: "S3", family: "setr", name: "Insurance policyholder tax adjustment opt-out", article: "Art. 3.2.9 / SETR", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Policyholder tax opt-out", defaultTx: "Art. 3.2.9 adjustment", electedTx: "No adjustment this year", consistency: "Annual", revocable: true, reelect: "yes", qdmtt: "n/a on this snapshot", impact: "Insurance groups", href: "/elections" },
  { id: "SETR_SHIP", n: "S4", family: "setr", name: "International Shipping exclusion opt-out", article: "SETR", scope: "JURISDICTION", duration: "five-year", gir: "jurisdictional", girField: "Shipping exclusion opt-out", defaultTx: "Exclude qualifying shipping income", electedTx: "Retain income/tax in Simplified ETR", consistency: "5-year", revocable: true, reelect: "restricted", qdmtt: "n/a", impact: "Shipping groups", href: "/elections" },
  { id: "SETR_CT_OIE", n: "S5", family: "setr", name: "Covered Taxes outside income-tax expense", article: "SETR", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Taxes outside ITE", defaultTx: "Exclude", electedTx: "Add to Simplified Taxes", consistency: "Annual", revocable: true, reelect: "yes", qdmtt: "Numerator", impact: "Simplified Taxes ↑", href: "/covered-taxes" },
  { id: "SETR_EQTAX", n: "S6", family: "setr", name: "Taxes related to equity-reported income", article: "SETR", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "Equity-reported taxes", defaultTx: "Exclude", electedTx: "Include", consistency: "Annual", revocable: true, reelect: "yes", qdmtt: "Numerator", impact: "Simplified Taxes", href: "/covered-taxes" },
  { id: "SETR_QRTC", n: "S7", family: "setr", name: "QRTC / MTTC adjustment", article: "SETR", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "QRTC/MTTC", defaultTx: "Accounting tax-reduction treatment", electedTx: "Gross-up Simplified Income and Simplified Taxes", consistency: "Annual. Thai QRTC is not enacted — do not book.", revocable: true, reelect: "yes", qdmtt: "Do not book Thai QRTC", impact: "Credit gross-up", href: "/thailand/boi" },
  { id: "SETR_4.5", n: "S8", family: "setr", name: "GloBE Loss Election inside Simplified ETR", article: "Art. 4.5 / SETR", scope: "JURISDICTION", duration: "first-gir", gir: "jurisdictional", girField: "GloBE Loss (SETR)", defaultTx: "Normal simplified deferred-tax method", electedTx: "Deemed loss DTA. Re-elect after revocation: NO.", consistency: "First GIR", revocable: true, reelect: "no", qdmtt: "DT", impact: "Same lock as full GloBE Art. 4.5", href: "/deferred-tax" },
  { id: "SETR_PE", n: "S9", family: "setr", name: "PE Simplification Election", article: "SETR", scope: "JURISDICTION_YEAR", duration: "annual", gir: "jurisdictional", girField: "PE simplification", defaultTx: "Normal PE allocation", electedTx: "Simplified branch treatment. Special continuation when a PE loss was absorbed in the Main Entity jurisdiction.", consistency: "Annual + continuation rules", revocable: true, reelect: "restricted", qdmtt: "Thai PE blending", impact: "Rayong PE vs TH001", href: "/thailand/entities" },
  { id: "SETR_PYE", n: "S10", family: "setr", name: "Post-year-end tax adjustment timing", article: "SETR · group 5-year", scope: "ALL_JURISDICTIONS", duration: "five-year", gir: "group", girField: "Post-year-end timing", defaultTx: "Recognise in accrual year", electedTx: "Move qualifying adjustments within 12 months back to the transaction year", consistency: "Group-wide 5-year — not a single-country switch", revocable: true, reelect: "restricted", qdmtt: "Year of tax", impact: "All jurisdictions", href: "/elections" },
  { id: "SETR_TP", n: "S11", family: "setr", name: "Transfer-pricing adjustment timing methodology", article: "SETR · group 5-year", scope: "ALL_JURISDICTIONS", duration: "five-year", gir: "group", girField: "TP timing methodology", defaultTx: "Accrual-year treatment", electedTx: "Transaction-year matching", consistency: "Group / 5-year", revocable: true, reelect: "restricted", qdmtt: "TP year", impact: "Ireland IP / Thai manufacturing", href: "/simulator" },
  { id: "SETR_SBTI", n: "S12", family: "setr", name: "SBTI Safe Harbour overlay on Simplified ETR", article: "SBTISH / SETR", scope: "JURISDICTION", duration: "annual", gir: "jurisdictional", girField: "SBTI overlay", defaultTx: "Normal tax-incentive treatment", electedTx: "SBTI treatment inside Simplified ETR", consistency: "Jurisdiction · tracing required", revocable: true, reelect: "yes", qdmtt: "BOI / DEI", impact: "Incentive in Simplified Taxes", href: "/safe-harbours" },
];

export const ELECTION_PLAY = [
  { n: "01", title: "Read the baseline", body: "Default GloBE is Core with no elective overlays. Do not start from a copilot guess.", href: "/etr", hrefLabel: "ETR" },
  { n: "02", title: "Run the eligibility engine", body: "Only legally available elections are offered. A JURISDICTION election binds every CE in that country. QDMTT / SbS status comes from the OECD Central Record.", href: "/elections", hrefLabel: "Election engine" },
  { n: "03", title: "Generate scenarios, then optimise", body: "GMT24 models eligible combinations — not 2^40 switches. Rank lowest FY tax, 5-year lock-in, compliance burden and audit risk. Then file the GIR election fields.", href: "/optimize", hrefLabel: "Optimize GloBE" },
];

/** Seeded facts used by the eligibility engine. Amounts in USD. Stock-comp is the Art. 3.2.2 illustration converted from the THB worked example. */
export const STOCK_COMP = [
  { iso: "TH", entityId: "TH-CE", name: "Aetherion (Thailand) Ltd.", book: 3_120_936, tax: 7_802_340, note: "THB 120m book / THB 300m tax deduction · BOT 38.45" },
  { iso: "TH", entityId: "TH-PE", name: "Rayong PE", book: 2_080_624, tax: 2_600_780, note: "THB 80m book / THB 100m tax deduction · BOT 38.45" },
  { iso: "IE", entityId: "IE-CE", name: "Aetherion Ireland Ltd.", book: 6_400_000, tax: 1_100_000, note: "Tax deduction below book — election would increase GloBE income" },
];

export const REALISATION_FV = [
  { iso: "TH", amount: 4_200_000, note: "Unrealised revaluation still in FANIL. Art. 3.2.5 would defer until realisation. May be limited to tangible assets." },
];

/** Teaching illustration (THB). Live Aetherion overlay uses STOCK_COMP in USD. */
export const WORKED_SBC_THB = {
  rate: 38.45,
  entities: [
    { name: "ABC Thailand", tax: 300_000_000, book: 120_000_000 },
    { name: "XYZ Thailand", tax: 100_000_000, book: 80_000_000 },
  ],
  without: { etr: 0.128, topUp: 46_000_000 },
  with: { etr: 0.156, topUp: 0 },
  note: "Worked example from the Art. 3.2.2 briefing. Not the live Aetherion overlay — that is posted from GloBE Core + STOCK_COMP.",
};

export function electionById(id: string) {
  return ELECTIONS.find((e) => e.id === id) ?? null;
}
