import { NextResponse } from "next/server";
import { pdfRows, pdfRuns } from "@/lib/pdfText";
import { csvRows, stripInstructions } from "@/lib/ai/documents";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Document processing service. Accepts one file and returns page-referenced text
 * (and cell rows for delimited files). Instruction-like lines are stripped and
 * counted so the client can show that the document was read as evidence only.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file missing" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (12 MB limit)" }, { status: 413 });
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let pages: { n: number; text: string; rows?: string[][] }[] = [];
  let type = "text";
  let stripped = 0;

  if (name.endsWith(".pdf") || buf.subarray(0, 5).toString() === "%PDF-") {
    type = "pdf";
    try {
      const rows = pdfRows(pdfRuns(buf));
      const byPage = new Map<number, string[]>();
      for (const r of rows) byPage.set(r.page, [...(byPage.get(r.page) ?? []), r.text]);
      pages = [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([p, lines]) => {
        const s = stripInstructions(lines);
        stripped += s.stripped;
        return { n: p + 1, text: s.kept.join("\n") };
      });
    } catch {
      pages = [];
    }
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".docx")) {
    type = "binary";
    pages = [];
  } else {
    const text = buf.toString("utf8");
    const lines = text.split(/\r?\n/);
    const s = stripInstructions(lines);
    stripped = s.stripped;
    const isDelimited = name.endsWith(".csv") || name.endsWith(".tsv");
    // Page = 60 lines so a passage reference stays meaningful for long text exports.
    const chunk = 60;
    for (let i = 0; i < s.kept.length; i += chunk) {
      const slice = s.kept.slice(i, i + chunk);
      pages.push({ n: i / chunk + 1, text: slice.join("\n"), rows: isDelimited ? csvRows(slice.join("\n")) : undefined });
    }
    type = isDelimited ? "csv" : "text";
  }
  return NextResponse.json({ pages, stripped, type });
}
