import type { Section } from "./types";

/**
 * CFO Briefing — presentation output. A self-contained HTML deck: one slide per
 * briefing section, keyboard/click navigation on screen, one slide per page
 * when printed to PDF. No external assets, so it opens anywhere and can be
 * attached to an email as-is. Every slide carries the calculation version and
 * the provisional flag so a figure can never travel without its version.
 */
export type DeckMeta = {
  title: string;
  audience: string;
  groupName: string;
  fy: string;
  calcVersion: string;
  preparedFor: string;
  preparedAt: string;
  provisional: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function slideTitle(s: Section) {
  if (s.title) return s.title;
  return { conclusion: "Headline", impact: "Movement and drivers", gaps: "Uncertainty", next: "Next steps", list: "Decisions", table: "Figures", facts: "Facts", authority: "Authority", warning: "Caution", steps: "Steps", text: "" }[s.kind as string] ?? s.kind;
}

function slideBody(s: Section) {
  const parts: string[] = [];
  if (s.text) parts.push(`<p class="${s.kind === "conclusion" ? "lead" : ""}">${esc(s.text)}</p>`);
  if (s.rows && s.head) parts.push(`<table><thead><tr>${s.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${s.rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i > 0 && /^[−$€£฿\d]/.test(c) ? "num" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  if (s.items?.length) parts.push(`<ul>${s.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>`);
  return parts.join("\n");
}

export function deckHtml(sections: Section[], m: DeckMeta): string {
  const stamp = `${esc(m.groupName)} · ${esc(m.fy)} · ${esc(m.calcVersion)}`;
  const flag = m.provisional ? `<span class="flag warn">PROVISIONAL</span>` : `<span class="flag ok">Approved snapshot</span>`;
  const slides = [
    `<section class="slide cover"><div class="k">Pillar Two briefing</div><h1>${esc(m.title)}</h1><p class="sub">${stamp}</p><p class="sub">${flag}</p><p class="meta">Prepared ${esc(m.preparedAt)} by GMT24 Co-Pilot for ${esc(m.preparedFor)} · draft for internal review</p></section>`,
    ...sections.map((s, i) => `<section class="slide"><div class="k">${esc(slideTitle(s))}</div>${slideBody(s)}<footer><span>${stamp}</span><span>${flag}</span><span>${i + 2} / ${sections.length + 2}</span></footer></section>`),
    `<section class="slide end"><div class="k">Basis of preparation</div><ul><li>Every figure is copied from calculation version <strong>${esc(m.calcVersion)}</strong>; none is estimated by the assistant.</li><li>Items marked provisional or X-Ray open may change when facts are confirmed.</li><li>Company-disclosed amounts, engine results and scenario outcomes are labelled as such.</li><li>Internal management draft — not tax advice, not a filing, not for external distribution.</li></ul><footer><span>${stamp}</span><span>${flag}</span><span>${sections.length + 2} / ${sections.length + 2}</span></footer></section>`,
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title)} — ${stamp}</title>
<style>
:root{--ink:#14202b;--muted:#5c6b7a;--accent:#0f5f8f;--warn:#b4530a;--ok:#1a7f4b;--line:#d9e0e6;--bg:#f4f6f8}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,"Segoe UI",Roboto,"Noto Sans Thai",Helvetica,Arial,sans-serif}
.deck{display:grid;gap:24px;padding:24px;max-width:1200px;margin:0 auto}
.slide{position:relative;background:#fff;border:1px solid var(--line);border-radius:12px;padding:44px 52px 64px;min-height:560px;aspect-ratio:16/9;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.k{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:12px}
h1{font-size:40px;line-height:1.1;margin:0 0 16px}.cover .sub{font-size:20px;color:var(--muted);margin:4px 0}.meta{color:var(--muted);font-size:14px;margin-top:32px}
.lead{font-size:26px;line-height:1.3;font-weight:600;margin:0}p{margin:0 0 12px}
ul{margin:0;padding-left:22px;font-size:19px}li{margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:17px;margin-top:8px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
footer{position:absolute;left:52px;right:52px;bottom:20px;display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
.flag{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.04em}.flag.warn{background:#fdf1e6;color:var(--warn)}.flag.ok{background:#e6f5ec;color:var(--ok)}
.nav{position:fixed;right:16px;bottom:16px;display:flex;gap:6px}.nav button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}
body.present .deck{display:block;padding:0;max-width:none}body.present .slide{display:none;border-radius:0;border:0;min-height:100vh;aspect-ratio:auto;padding:6vh 8vw 10vh}body.present .slide.on{display:block}body.present .lead{font-size:3.2vw}body.present h1{font-size:4.6vw}body.present ul,body.present table{font-size:2.1vw}
@media print{body{background:#fff}.deck{display:block;padding:0;max-width:none}.slide{page-break-after:always;border:0;border-radius:0;box-shadow:none;min-height:auto;aspect-ratio:auto;height:100vh;padding:40px 48px 60px}.nav{display:none}}
</style></head>
<body><main class="deck">${slides.join("\n")}</main>
<div class="nav"><button data-a="present">Present</button><button data-a="print">Print / PDF</button></div>
<script>
(function(){var s=document.querySelectorAll('.slide'),i=0,b=document.body;function show(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(x,k){x.classList.toggle('on',k===i)});}
document.querySelector('[data-a=present]').onclick=function(){b.classList.toggle('present');show(i)};document.querySelector('[data-a=print]').onclick=function(){window.print()};
document.addEventListener('keydown',function(e){if(!b.classList.contains('present')){if(e.key==='p'||e.key==='P'){b.classList.add('present');show(0)}return}if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown')show(i+1);else if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);else if(e.key==='Escape')b.classList.remove('present')});
document.addEventListener('click',function(e){if(b.classList.contains('present')&&!e.target.closest('.nav'))show(i+1)});})();
</script></body></html>`;
}
