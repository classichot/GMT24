import "server-only";

/**
 * Public-source discovery for Quick Scan. Searches configured web-search
 * providers for a company's official investor-relations, exchange or regulator
 * documents and classifies the hits. No demo corpus is consulted here: an
 * unknown company either resolves to real sources or is reported as not found.
 *
 *   GMT24_SEARCH_PROVIDER  tavily | brave | serper | duckduckgo (default when no key)
 *   GMT24_SEARCH_API_KEY   key for the chosen provider (TAVILY_API_KEY / BRAVE_SEARCH_API_KEY / SERPER_API_KEY also read)
 */

export type SearchHit = { title: string; url: string; snippet: string };
export type DocKind = "annual-report" | "financial-statements" | "form-56-1" | "exchange-filing" | "ir-website" | "regulator";
export type Candidate = { url: string; title: string; kind: DocKind; domain: string; isPdf: boolean; period: string | null; official: boolean; score: number; snippet: string };
export type Discovery = {
  query: string;
  provider: string;
  searchedAt: string;
  hits: number;
  candidates: Candidate[];
  /** Domains that look like the company's own or an exchange/regulator. */
  officialDomains: string[];
  /** Distinct company names seen in official titles — more than one means the user must pick. */
  namesSeen: string[];
  notes: string[];
};

function env(n: string) { const v = process.env[n]; return v && v.trim() ? v.trim() : undefined; }

export function searchConfig(): { provider: "tavily" | "brave" | "serper" | "duckduckgo"; key: string | null } {
  const p = env("GMT24_SEARCH_PROVIDER");
  const key = env("GMT24_SEARCH_API_KEY");
  if (p === "tavily" || (!p && env("TAVILY_API_KEY"))) return { provider: "tavily", key: key ?? env("TAVILY_API_KEY") ?? null };
  if (p === "brave" || (!p && env("BRAVE_SEARCH_API_KEY"))) return { provider: "brave", key: key ?? env("BRAVE_SEARCH_API_KEY") ?? null };
  if (p === "serper" || (!p && env("SERPER_API_KEY"))) return { provider: "serper", key: key ?? env("SERPER_API_KEY") ?? null };
  return { provider: "duckduckgo", key: null };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

function decode(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchWeb(q: string, limit = 10): Promise<SearchHit[]> {
  const cfg = searchConfig();
  if (cfg.provider === "tavily" && cfg.key) {
    const res = await fetchWithTimeout("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: cfg.key, query: q, max_results: limit, search_depth: "basic" }) }, 15000);
    if (!res.ok) throw new Error(`tavily ${res.status}`);
    const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
    return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content ?? "" }));
  }
  if (cfg.provider === "brave" && cfg.key) {
    const res = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${limit}`, { headers: { accept: "application/json", "x-subscription-token": cfg.key } }, 15000);
    if (!res.ok) throw new Error(`brave ${res.status}`);
    const data = (await res.json()) as { web?: { results?: { title: string; url: string; description: string }[] } };
    return (data.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description ?? "" }));
  }
  if (cfg.provider === "serper" && cfg.key) {
    const res = await fetchWithTimeout("https://google.serper.dev/search", { method: "POST", headers: { "content-type": "application/json", "x-api-key": cfg.key }, body: JSON.stringify({ q, num: limit }) }, 15000);
    if (!res.ok) throw new Error(`serper ${res.status}`);
    const data = (await res.json()) as { organic?: { title: string; link: string; snippet: string }[] };
    return (data.organic ?? []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet ?? "" }));
  }
  // Keyless fallback: DuckDuckGo HTML endpoint. Best effort; rate limited and may block.
  const res = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers: { "user-agent": "Mozilla/5.0 (compatible; GMT24 QuickScan/1.0)", accept: "text/html" } }, 15000);
  if (!res.ok) throw new Error(`duckduckgo ${res.status}`);
  const html = await res.text();
  const out: SearchHit[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  for (const m of html.matchAll(re)) {
    let url = m[1];
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (!/^https?:/.test(url)) continue;
    out.push({ title: decode(m[2]), url, snippet: decode(m[3] ?? "") });
    if (out.length >= limit) break;
  }
  return out;
}

const NON_OFFICIAL = /wikipedia|bloomberg|reuters|marketscreener|yahoo|google|linkedin|facebook|twitter|x\.com|crunchbase|zoominfo|dnb\.com|annualreports\.com|morningstar|investing\.com|wsj|ft\.com|forbes|craft\.co|glassdoor|indeed|tradingview|macrotrends|stockanalysis|simplywall|companiesmarketcap|opencorporates|scribd|studocu|coursehero|pitchbook|owler|rocketreach|apollo\.io|statista/i;
const EXCHANGE = /set\.or\.th|setlink|sec\.or\.th|sec\.gov|sgx\.com|sgxnet|hkexnews|hkex\.com|londonstockexchange|asx\.com|idx\.co\.id|bursamalaysia|klsesc|nse\.com|bseindia|jpx\.co\.jp|tse\.or\.jp|euronext|deutsche-boerse|companieshouse|efrag|esma|edinet|tdnet|sedar|companies-register|kap\.org|twse|pse\.com\.ph|hnx\.vn|hsx\.vn|ssc\.gov\.vn/i;

function periodFrom(s: string): string | null {
  const m = s.match(/\b(20[1-3]\d)\b/g);
  if (!m) return null;
  const years = m.map(Number).filter((y) => y >= 2015 && y <= 2035);
  if (!years.length) return null;
  return `FY${Math.max(...years)}`;
}

function classify(h: SearchHit, company: string): Candidate | null {
  let u: URL;
  try { u = new URL(h.url); } catch { return null; }
  const domain = u.hostname.replace(/^www\./, "");
  const text = `${h.title} ${h.url} ${h.snippet}`;
  const isPdf = /\.pdf(\?|$)/i.test(h.url) || /\bpdf\b/i.test(h.title);
  const exchange = EXCHANGE.test(domain);
  const nonOfficial = NON_OFFICIAL.test(domain);
  const nameTokens = company.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && !/^(the|plc|pcl|ltd|limited|inc|corp|corporation|company|co|public|group|holdings?|berhad|bhd|tbk|pt|ag|sa|nv|se|ab|oyj|asa)$/.test(t));
  const domainMatches = nameTokens.some((t) => domain.includes(t.replace(/[^a-z0-9]/g, "")));
  const official = exchange || (domainMatches && !nonOfficial);
  let kind: DocKind | null = null;
  if (/56-1|one report|แบบ 56/i.test(text)) kind = "form-56-1";
  else if (/annual report|integrated report|รายงานประจำปี|jahresbericht|rapport annuel|10-k\b|20-f\b/i.test(text)) kind = "annual-report";
  else if (/financial statements?|consolidated (accounts|statements)|งบการเงิน|audited/i.test(text)) kind = "financial-statements";
  else if (exchange) kind = "exchange-filing";
  else if (/investor|shareholder|ir\.|investors\./i.test(text) && official) kind = "ir-website";
  else if (/regulator|securities commission|sec filing/i.test(text)) kind = "regulator";
  if (!kind) return null;
  if (nonOfficial && !isPdf) return null;
  let score = 0;
  if (official) score += 3;
  if (isPdf) score += 2;
  if (kind === "annual-report" || kind === "form-56-1") score += 2;
  if (kind === "financial-statements") score += 1;
  if (nameTokens.some((t) => h.title.toLowerCase().includes(t))) score += 1;
  const period = periodFrom(text);
  if (period) score += 1;
  return { url: h.url, title: h.title || h.url, kind, domain, isPdf, period, official, score, snippet: h.snippet };
}

export async function discoverCompany(company: string): Promise<Discovery> {
  const cfg = searchConfig();
  const notes: string[] = [];
  const queries = [
    `"${company}" annual report filetype:pdf`,
    `"${company}" investor relations annual report`,
    `${company} financial statements 2025 pdf`,
    `${company} "56-1 One Report" OR "annual report" download`,
  ];
  const all: SearchHit[] = [];
  let failures = 0;
  for (const q of queries) {
    try { all.push(...(await searchWeb(q, 10))); } catch (e) { failures += 1; notes.push(`Search failed for "${q}": ${e instanceof Error ? e.message : String(e)}`); }
  }
  // Second hop: official HTML pages (IR sites, exchange filing lists) usually link the PDFs directly.
  const officialPages = all.map((h) => classify(h, company)).filter((c): c is Candidate => !!c && c.official && !c.isPdf).slice(0, 3);
  for (const pg of officialPages) {
    try {
      const links = await harvestPdfLinks(pg.url);
      for (const l of links) all.push({ title: l.title, url: l.url, snippet: `Linked from ${pg.domain}` });
      if (links.length) notes.push(`${links.length} PDF link${links.length === 1 ? "" : "s"} found on ${pg.domain}.`);
    } catch { /* page not reachable — candidates from search stand */ }
  }
  if (failures === queries.length) notes.push(cfg.provider === "duckduckgo" ? "No search provider key is configured; the keyless fallback was blocked. Configure GMT24_SEARCH_PROVIDER + GMT24_SEARCH_API_KEY (Tavily, Brave or Serper) or upload the report." : `Search provider ${cfg.provider} is not responding.`);
  const seen = new Set<string>();
  const cands: Candidate[] = [];
  for (const h of all) {
    const key = h.url.replace(/[#?].*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const c = classify(h, company);
    if (c) cands.push(c);
  }
  cands.sort((a, b) => b.score - a.score);
  const officialDomains = [...new Set(cands.filter((c) => c.official).map((c) => c.domain))];
  const NAME_RE = /\b([A-Z][A-Za-z0-9&.'’-]*(?:\s+[A-Z(][A-Za-z0-9&.'’()-]*){0,6}\s+(?:Public Company Limited|PCL|Plc|PLC|Ltd\.?|Limited|Inc\.?|Corporation|Corp\.?|Berhad|Bhd\.?|Tbk|AG|SA|S\.A\.|N\.V\.|SE|Oyj|ASA|Co\.,? Ltd\.?|Holdings))\b/g;
  const namesSeen = [...new Set(all.flatMap((h) => [...`${h.title} ${h.snippet}`.matchAll(NAME_RE)].map((m) => m[1].replace(/\s+/g, " ").trim())))].filter((n) => n.length > 5 && n.length < 90).slice(0, 8);
  if (!cands.length && !failures) notes.push(`No official disclosures found for "${company}" in ${all.length} search results. Check the spelling, try the listed parent's name, or upload the annual report.`);
  return { query: company, provider: cfg.provider, searchedAt: new Date().toISOString(), hits: all.length, candidates: cands.slice(0, 12), officialDomains, namesSeen, notes };
}

/** Collect PDF links from an official HTML page (IR site, exchange filing list). */
export async function harvestPdfLinks(pageUrl: string): Promise<{ url: string; title: string }[]> {
  const res = await fetchWithTimeout(pageUrl, { headers: { "user-agent": "Mozilla/5.0 (compatible; GMT24 QuickScan/1.0)", accept: "text/html" } }, 15000);
  if (!res.ok) return [];
  const ct = res.headers.get("content-type") ?? "";
  if (!/html/i.test(ct)) return [];
  const html = (await res.text()).slice(0, 3_000_000);
  const base = new URL(res.url || pageUrl);
  const out: { url: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const href = m[1];
    if (!/\.pdf(\?|$)/i.test(href) && !/download|attachment|file/i.test(href)) continue;
    let abs: string;
    try { abs = new URL(href, base).toString(); } catch { continue; }
    if (seen.has(abs)) continue;
    const text = decode(m[2]) || decode(html.slice(Math.max(0, m.index! - 200), m.index!)).split(/\s{2,}/).pop() || abs.split("/").pop() || abs;
    if (!/annual|report|financial|statement|56-1|one report|รายงาน|งบการเงิน|\.pdf/i.test(`${text} ${href}`)) continue;
    seen.add(abs);
    out.push({ url: abs, title: text.slice(0, 120) });
    if (out.length >= 25) break;
  }
  return out;
}

/* ---------- document fetch ---------- */

export type FetchedDoc = { url: string; finalUrl: string; contentType: string; bytes: number; pages: { n: number; text: string }[]; title: string; isPdf: boolean; notes: string[] };

const MAX_DOC_BYTES = 40 * 1024 * 1024;

export async function fetchDocument(url: string): Promise<FetchedDoc> {
  const { pdfPages } = await import("@/lib/server/pdf");
  const res = await fetchWithTimeout(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; GMT24 QuickScan/1.0)", accept: "application/pdf,text/html;q=0.9,*/*;q=0.8" }, redirect: "follow" }, 45000);
  if (!res.ok) throw new Error(`Source returned ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_DOC_BYTES) throw new Error(`Document is ${Math.round(len / 1e6)} MB; the 40 MB limit applies. Upload the relevant sections instead.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_DOC_BYTES) throw new Error("Document exceeds the 40 MB limit.");
  const notes: string[] = [];
  const isPdf = /pdf/i.test(ct) || buf.subarray(0, 5).toString() === "%PDF-";
  let pages: { n: number; text: string }[] = [];
  let title = url.split("/").pop() ?? url;
  if (isPdf) {
    const r = await pdfPages(buf);
    pages = r.pages;
    notes.push(...r.notes);
  } else if (/html|xml|text/i.test(ct)) {
    const html = buf.toString("utf8");
    title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? title);
    const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<\/(p|div|li|tr|h\d|br)>/gi, "\n"));
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 80) pages.push({ n: i / 80 + 1, text: lines.slice(i, i + 80).join("\n") });
  } else {
    notes.push(`Unsupported content type ${ct || "unknown"}.`);
  }
  return { url, finalUrl: res.url || url, contentType: ct, bytes: buf.length, pages, title, isPdf, notes };
}
