import { isCatalogQuestion } from "./catalog";
import type { FeatureId, InteractionMode, Lang } from "./types";

/**
 * Co-Pilot router. Decides which feature answers a message: an explicit mode chip
 * wins; otherwise the intent is read from the text (Thai or English) and the
 * screen the user is on. The router never answers — it dispatches.
 */
export type Intent = { feature: FeatureId; mode: InteractionMode | null; confidence: number; why: string; audience?: "cfo" | "committee" | "board" };

type Rule = { feature: FeatureId; re: RegExp; weight: number; mode?: InteractionMode; audience?: Intent["audience"] };

const RULES: Rule[] = [
  { feature: "feedback", re: /\b(bug|broken|doesn'?t work|not working|crash\w*|freez\w*|typo|wrong label|(this|the) (number|figure|amount|total|screen|page|label|button) (is|looks|seems) wrong|feature request|suggestion|would be (nice|better)|report (a|an|this) (bug|issue|problem))\b|ไม่ทำงาน|ข้อเสนอ|แจ้งปัญหา|บั๊ก|หน้าค้าง|ค้าง/i, weight: 0.9 },
  { feature: "quickscan", re: /\b(quick ?scan|scan (the )?(group|company)|public (evidence|disclosures)|annual report of|56-1|exposure of [A-Z])|สแกน|รายงานประจำปี/i, weight: 0.85 },
  { feature: "strategy", re: /\b(what if|if we|scenario|simulat|extend(ing)? (the )?(boi|holiday)|convert (the )?(holiday|boi)|increase (the )?payroll|move (the )?(ip|function|margin)|reduce (the )?(margin|top-?up by)|sensitivit)\b|จำลอง|ถ้าเรา|สมมติ/i, weight: 0.85 },
  { feature: "rehearsal", re: /\b(audit(or)?s? (would|will|might|could) ask|rehears|defend|revenue department|the rd\b|tax authority|prepare (for|us for) (an|the) audit|readiness)\b|ซ้อม|กรมสรรพากร|ผู้ตรวจสอบ/i, weight: 0.85 },
  { feature: "briefing", re: /\b(brief(ing)?|memo|board (pack|paper)|for the (cfo|board|committee)|executive summary|slides?)\b|สรุปสำหรับ|บอร์ด/i, weight: 0.8 },
  { feature: "regwatch", re: /\b(new (guidance|rule|regulation|decree)|administrative guidance|central record|regulator|what changed in the rules|pending guidance|impact of (the )?(new|latest))\b|กฎเกณฑ์ใหม่|ประกาศใหม่|แนวปฏิบัติ/i, weight: 0.8 },
  { feature: "reviewer", re: /\b(review (the|my|this) (calc|calculation|numbers|package)|anything (wrong|off|missing)|check (the|my|this) (calc|numbers|mapping)|reconcil|second[- ]level|findings)\b|ตรวจสอบการคำนวณ|ตรวจการคำนวณ/i, weight: 0.8 },
  { feature: "interviewer", re: /\b(x-?ray|open questions?|what do you need from me|confirm(ation)?s? (for|of)|which facts|interview)\b|คำถามที่เปิด|ยืนยันข้อเท็จจริง/i, weight: 0.8 },
  { feature: "explain", re: /\b(why is (the|this|our)? ?[\w ]*(top-?up|etr|number|amount|figure|sbie|covered tax|globe income)|explain (this|the|that) (number|amount|figure|top-?up|etr)|how (is|was|did) .* (calculated|computed|derived|arrive)|where does .* come from|break(down)? (this|the) (number|amount)|source of (this|the))\b|ทำไม.*(ตัวเลข|top-?up|etr)|อธิบาย.*(ตัวเลข|จำนวน|top-?up|etr|sbie|globe)|อธิบายตัวเลข|คำนวณอย่างไร|มาจากไหน/i, weight: 0.85 },
  { feature: "trainer", re: /\b(how do i|how can i|where (do|can) i|what does this (screen|page|button|field|column|menu)|what (is|does) (this|the) (screen|page|button|field|column|menu)|what is .+ (for|for\?|built for)|walk me|show me (how|where)|next step|what should i do|onboard|get started|i'?m (new|lost)|guide me|playbook)\b|ทำอย่างไร|อยู่ที่ไหน|ขั้นตอนต่อไป|เริ่มต้น|หน้านี้|เมนูนี้|คู่มือ|สำหรับอะไร/i, weight: 0.8 },
];

const MODE_RE: [RegExp, InteractionMode][] = [
  [/\b(show me|where is|take me|open)\b|พาไป|อยู่ที่ไหน/i, "show"],
  [/\b(do it|complete|finish|help me (do|complete|finish)|for me)\b|ทำให้|ช่วยทำ/i, "complete"],
];

const AUDIENCE_RE: [RegExp, Intent["audience"]][] = [[/\bboard\b|บอร์ด|กรรมการบริษัท/i, "board"], [/\bcommittee\b|คณะกรรมการ/i, "committee"], [/\bcfo\b|ซีเอฟโอ/i, "cfo"]];

export function detectIntent(q: string, screenKey: string | null, forced: FeatureId | null): Intent {
  const mode = MODE_RE.find(([re]) => re.test(q))?.[1] ?? null;
  const audience = AUDIENCE_RE.find(([re]) => re.test(q))?.[1];
  if (forced) return { feature: forced, mode, confidence: 1, why: "Mode selected by user.", audience };
  if (isCatalogQuestion(q)) return { feature: "trainer", mode, confidence: 0.95, why: "Named a GMT24 menu or playbook.", audience };
  let best: { r: Rule; score: number } | null = null;
  for (const r of RULES) {
    if (!r.re.test(q)) continue;
    let score = r.weight;
    if (screenKey && SCREEN_BIAS[screenKey] === r.feature) score += 0.1;
    if (!best || score > best.score) best = { r, score };
  }
  if (best) return { feature: best.r.feature, mode, confidence: best.score, why: `Matched ${best.r.feature} intent.`, audience };
  const biased = screenKey ? SCREEN_BIAS[screenKey] : undefined;
  if (biased && /\?$/.test(q.trim()) && q.length < 60 && !/\b(art\.?|article|rule|globe|oecd|pillar|tax|etr|top-?up|election|safe harbour)\b/i.test(q)) return { feature: biased, mode, confidence: 0.5, why: `Short question on the ${screenKey} screen.`, audience };
  return { feature: "specialist", mode, confidence: 0.6, why: "Default: legal or calculation question.", audience };
}

/** Screens where a short, screen-bound question is most likely for a given feature. */
const SCREEN_BIAS: Record<string, FeatureId> = {
  xray: "interviewer",
  "xray-confirm": "interviewer",
  issues: "reviewer",
  reviewer: "reviewer",
  strategy: "strategy",
  optimize: "strategy",
  rehearsal: "rehearsal",
  regwatch: "regwatch",
  jurisdictions: "regwatch",
  briefing: "briefing",
  feedback: "feedback",
  trainer: "trainer",
  copilot: "trainer",
  tasks: "trainer",
  quickscan: "quickscan",
  audit: "explain",
  data: "trainer",
  mapping: "trainer",
};

export const FEATURE_CHIPS: { id: FeatureId; label: string; labelTh: string }[] = [
  { id: "specialist", label: "Specialist", labelTh: "ผู้เชี่ยวชาญ" },
  { id: "trainer", label: "Trainer", labelTh: "ฝึกสอน" },
  { id: "explain", label: "Explain number", labelTh: "อธิบายตัวเลข" },
  { id: "interviewer", label: "X-Ray interview", labelTh: "สัมภาษณ์ X-Ray" },
  { id: "reviewer", label: "Reviewer", labelTh: "ผู้ตรวจ" },
  { id: "strategy", label: "Strategy", labelTh: "กลยุทธ์" },
  { id: "rehearsal", label: "Audit rehearsal", labelTh: "ซ้อมตรวจ" },
  { id: "regwatch", label: "Reg watch", labelTh: "กฎเกณฑ์" },
  { id: "briefing", label: "CFO briefing", labelTh: "สรุป CFO" },
  { id: "quickscan", label: "Quick Scan", labelTh: "สแกน" },
  { id: "feedback", label: "Feedback", labelTh: "ข้อเสนอแนะ" },
];

export const SUGGESTIONS: Record<string, { en: string[]; th: string[] }> = {
  general: { en: ["What is this menu for?", "Show the AI Co-Pilot playbook", "What is Quick Scan built for?", "Why is the Vietnam top-up what it is?"], th: ["เมนูนี้ทำอะไร", "เปิดคู่มือ AI Co-Pilot", "Quick Scan สร้างมาเพื่ออะไร", "ทำไม top-up เวียดนามเป็นตัวเลขนี้"] },
  xray: { en: ["What do you need from me?", "Which X-Ray questions matter most?", "Explain the Thailand finding"], th: ["ต้องการข้อมูลอะไรจากฉัน", "คำถาม X-Ray ข้อไหนสำคัญที่สุด"] },
  data: { en: ["What is this menu for?", "How do I approve a mapping?", "What is the next step?"], th: ["เมนูนี้ทำอะไร", "อนุมัติการจับคู่บัญชีอย่างไร", "ขั้นตอนต่อไปคืออะไร"] },
  audit: { en: ["Explain this number", "Why did it change from the prior year?"], th: ["อธิบายตัวเลขนี้"] },
  quickscan: { en: ["Scan Siam Verdant Foods", "Explain the Vietnam flag", "What would change the Cambodia assessment?"], th: ["สแกน สยามเวอร์แดนท์", "อธิบายธงเวียดนาม"] },
  briefing: { en: ["Draft the CFO briefing", "Brief the board on exposure and uncertainty"], th: ["ร่างสรุปสำหรับ CFO"] },
};

export function suggestionsFor(screenKey: string | null, lang: Lang) {
  return (SUGGESTIONS[screenKey ?? "general"] ?? SUGGESTIONS.general)[lang];
}
