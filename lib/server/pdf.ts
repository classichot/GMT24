import "server-only";

/**
 * Document processing service: page-referenced text from PDFs. Uses pdf.js
 * (font-aware, handles CID/Identity-H encodings used by report designers) and
 * falls back to the in-house positional extractor for damaged files. Line
 * breaks are reconstructed from glyph positions so passages read naturally
 * and can be matched back to a page.
 */

export type PdfPage = { n: number; text: string };

type TextItem = { str: string; transform: number[]; hasEOL?: boolean };

async function loadPdfJs() {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return mod;
}

export async function pdfPages(buf: Buffer, opts: { maxPages?: number; signal?: AbortSignal } = {}): Promise<{ pages: PdfPage[]; engine: "pdfjs" | "positional"; notes: string[] }> {
  const notes: string[] = [];
  try {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, isEvalSupported: false, verbosity: 0 });
    const doc = await task.promise;
    const total = Math.min(doc.numPages, opts.maxPages ?? 600);
    if (doc.numPages > total) notes.push(`Document has ${doc.numPages} pages; the first ${total} were read.`);
    const pages: PdfPage[] = [];
    for (let i = 1; i <= total; i++) {
      if (opts.signal?.aborted) throw new Error("aborted");
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as TextItem[];
      let out = "";
      let lastY: number | null = null;
      let lastX: number | null = null;
      for (const it of items) {
        if (!it.str) { if (it.hasEOL) out += "\n"; continue; }
        const x = it.transform[4];
        const y = it.transform[5];
        if (lastY != null && Math.abs(y - lastY) > 2) out += "\n";
        else if (lastX != null && x - lastX > 1 && out && !/\s$/.test(out)) out += " ";
        out += it.str;
        if (it.hasEOL) out += "\n";
        lastY = y;
        lastX = x + (it.str.length * 4);
      }
      page.cleanup();
      pages.push({ n: i, text: out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() });
    }
    await doc.destroy();
    const withText = pages.filter((p) => p.text.length > 20).length;
    if (withText === 0) notes.push("No text layer found (scanned document?). OCR is not available in this deployment.");
    return { pages, engine: "pdfjs", notes };
  } catch (e) {
    if (e instanceof Error && e.message === "aborted") throw e;
    notes.push(`pdf.js could not read the file (${e instanceof Error ? e.message : String(e)}); positional fallback used.`);
    const { pdfRows, pdfRuns } = await import("@/lib/pdfText");
    try {
      const rows = pdfRows(pdfRuns(buf));
      const byPage = new Map<number, string[]>();
      for (const r of rows) byPage.set(r.page, [...(byPage.get(r.page) ?? []), r.text]);
      return { pages: [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([p, lines]) => ({ n: p + 1, text: lines.join("\n") })), engine: "positional", notes };
    } catch {
      return { pages: [], engine: "positional", notes: [...notes, "PDF could not be parsed."] };
    }
  }
}
