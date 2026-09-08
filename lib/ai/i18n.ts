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

/**
 * Words a user may type for a jurisdiction: English name, adjective, and Thai
 * name. Longest match wins so "hong kong" beats "kong" and Thai compounds resolve
 * before their parts. Two-letter ISO codes are matched separately as whole words.
 */
export const JURISDICTION_WORDS: Record<string, string> = {
  thailand: "TH", thai: "TH", ประเทศไทย: "TH", ไทย: "TH",
  ireland: "IE", irish: "IE", ไอร์แลนด์: "IE",
  vietnam: "VN", "viet nam": "VN", vietnamese: "VN", เวียดนาม: "VN",
  "hong kong": "HK", ฮ่องกง: "HK",
  singapore: "SG", singaporean: "SG", สิงคโปร์: "SG",
  malaysia: "MY", malaysian: "MY", มาเลเซีย: "MY",
  indonesia: "ID", indonesian: "ID", อินโดนีเซีย: "ID",
  india: "IN", indian: "IN", อินเดีย: "IN",
  "united states": "US", usa: "US", america: "US", american: "US", สหรัฐ: "US", อเมริกา: "US",
  china: "CN", chinese: "CN", จีน: "CN",
  japan: "JP", japanese: "JP", ญี่ปุ่น: "JP",
  "united kingdom": "GB", britain: "GB", british: "GB", อังกฤษ: "GB", สหราชอาณาจักร: "GB",
  germany: "DE", german: "DE", เยอรมนี: "DE", เยอรมัน: "DE",
  france: "FR", french: "FR", ฝรั่งเศส: "FR",
  netherlands: "NL", dutch: "NL", holland: "NL", เนเธอร์แลนด์: "NL",
  luxembourg: "LU", ลักเซมเบิร์ก: "LU",
  hungary: "HU", hungarian: "HU", ฮังการี: "HU",
  "united arab emirates": "AE", uae: "AE", dubai: "AE", สหรัฐอาหรับเอมิเรตส์: "AE", ดูไบ: "AE",
  peru: "PE", peruvian: "PE", เปรู: "PE",
  cambodia: "KH", cambodian: "KH", กัมพูชา: "KH",
  australia: "AU", australian: "AU", ออสเตรเลีย: "AU",
  "cayman islands": "KY", cayman: "KY", เคย์แมน: "KY",
};

const JW_SORTED = Object.entries(JURISDICTION_WORDS).sort((a, b) => b[0].length - a[0].length);

/** ISO codes named in free text, in order of appearance. Accepts names, adjectives, Thai names and whole-word ISO codes. */
export function isosIn(text: string): string[] {
  const l = text.toLowerCase();
  const found: { at: number; iso: string }[] = [];
  for (const [w, iso] of JW_SORTED) {
    let from = 0;
    while (from < l.length) {
      const at = l.indexOf(w, from);
      if (at < 0) break;
      const before = l[at - 1];
      const after = l[at + w.length];
      const asciiWord = /[a-z]/.test(w[0]);
      const bounded = !asciiWord || ((!before || !/[a-z]/.test(before)) && (!after || !/[a-z]/.test(after)));
      if (bounded && !found.some((f) => f.iso === iso)) found.push({ at, iso });
      from = at + w.length;
    }
  }
  const shouting = /[A-Z]/.test(text) && !/[a-z]/.test(text);
  for (const m of shouting ? [] : text.matchAll(/(^|[^A-Za-z])([A-Z]{2})(?![A-Za-z])/g)) {
    const iso = m[2];
    if (!found.some((f) => f.iso === iso)) found.push({ at: m.index ?? 0, iso });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.iso);
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
