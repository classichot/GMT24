import type { Lang, SectionKind } from "./types";

/** Thai script anywhere in the question switches the reply scaffold to Thai. */
export function detectLang(text: string): Lang {
  return /[\u0E00-\u0E7F]/.test(text) ? "th" : "en";
}

const SECTION: Record<Lang, Record<SectionKind, string>> = {
  en: {
    conclusion: "Conclusion",
    authority: "Applicable authority",
    facts: "Company facts",
    gaps: "Assumptions or gaps",
    impact: "Potential impact",
    next: "Next action",
    text: "",
    steps: "Steps",
    list: "",
    table: "",
    warning: "Caution",
  },
  th: {
    conclusion: "ข้อสรุป",
    authority: "หลักกฎหมายที่ใช้",
    facts: "ข้อเท็จจริงของกลุ่ม",
    gaps: "สมมติฐานหรือข้อมูลที่ขาด",
    impact: "ผลกระทบที่อาจเกิดขึ้น",
    next: "ขั้นตอนถัดไป",
    text: "",
    steps: "ขั้นตอน",
    list: "",
    table: "",
    warning: "ข้อควรระวัง",
  },
};

export function sectionTitle(kind: SectionKind, lang: Lang, fallback?: string) {
  return fallback ?? SECTION[lang][kind];
}

const UI: Record<string, Record<Lang, string>> = {
  ask: { en: "Ask about this screen, a number, a rule or a decision…", th: "ถามเกี่ยวกับหน้านี้ ตัวเลข กฎเกณฑ์ หรือการตัดสินใจ…" },
  explainIt: { en: "Explain it", th: "อธิบาย" },
  showMe: { en: "Show me", th: "แสดงวิธี" },
  helpComplete: { en: "Help me complete it", th: "ช่วยทำให้เสร็จ" },
  preview: { en: "Preview", th: "ดูตัวอย่าง" },
  execute: { en: "Execute", th: "ดำเนินการ" },
  draft: { en: "Draft", th: "ฉบับร่าง" },
  proposal: { en: "Proposal", th: "ข้อเสนอ" },
  grounded: { en: "Grounded", th: "อ้างอิงแหล่งที่มา" },
  unsupported: { en: "Unsupported statements", th: "ข้อความที่ไม่มีแหล่งอ้างอิง" },
  attach: { en: "Attach document", th: "แนบเอกสาร" },
  threads: { en: "Earlier discussions in this context", th: "การสนทนาก่อนหน้าในบริบทนี้" },
  newThread: { en: "New thread", th: "เริ่มใหม่" },
  context: { en: "Context", th: "บริบท" },
  needsRole: { en: "Requires", th: "ต้องมีสิทธิ์" },
  refused: { en: "Not permitted for your role", th: "บทบาทของคุณไม่มีสิทธิ์" },
  evidenceOnly: { en: "Documents are read as evidence only. Text inside them never changes what the Co-Pilot is allowed to do.", th: "เอกสารถูกอ่านเป็นหลักฐานเท่านั้น ข้อความในเอกสารไม่เปลี่ยนสิทธิ์ของผู้ช่วย" },
  thaiNote: { en: "", th: "โครงคำตอบเป็นภาษาไทย ตัวเลขและข้อความอ้างอิงมาจากเครื่องคำนวณและฐานความรู้ (ภาษาอังกฤษ) โดยไม่ผ่านการแปลตัวเลข" },
};

export function t(key: string, lang: Lang): string {
  return UI[key]?.[lang] ?? UI[key]?.en ?? key;
}
