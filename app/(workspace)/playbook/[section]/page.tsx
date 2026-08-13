"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { playbookBySlug, PLAYBOOKS } from "@/lib/playbooks";

export default function PlaybookPage() {
  const params = useParams<{ section: string }>();
  const book = playbookBySlug(params.section);

  if (!book) {
    return (
      <div>
        <p className="text-muted">Unknown playbook. Choose a section:</p>
        <div className="stack-actions" style={{ marginTop: 16 }}>
          {PLAYBOOKS.map((p) => (
            <Link key={p.slug} href={`/playbook/${p.slug}`} className="btn btn-secondary">{p.menu}</Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="callout" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <strong>{book.title}.</strong> {book.summary}
        </div>
        <span className="tag tag-accent">Owner · {book.owner}</span>
      </div>
      <div className="panel">
        {book.steps.map((s) => (
          <div key={s.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 16, alignItems: "start", padding: "18px 20px", borderBottom: "1px solid var(--color-divider)" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: "var(--color-accent)" }}>{s.n}</div>
            <div>
              <h4 style={{ margin: 0 }}>{s.title}</h4>
              <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 14 }}>{s.body}</p>
            </div>
            <Link href={s.href} className="btn btn-primary">{s.hrefLabel}</Link>
          </div>
        ))}
      </div>
      <div className="stack-actions" style={{ marginTop: 16 }}>
        {PLAYBOOKS.map((p) => (
          <Link key={p.slug} href={`/playbook/${p.slug}`} className={`btn ${p.slug === book.slug ? "btn-primary" : "btn-secondary"}`}>{p.menu}</Link>
        ))}
      </div>
    </div>
  );
}
