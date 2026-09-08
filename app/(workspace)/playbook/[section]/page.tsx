"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { bookBySlug, numberedMenuBooks } from "@/lib/menuPlaybooks";
import { readInviteSession } from "@/lib/invite";
import { useStore } from "@/lib/store";

export default function PlaybookPage() {
  const params = useParams<{ section: string }>();
  const { mode } = useStore();
  const [invite, setInvite] = useState(false);
  useEffect(() => { setInvite(!!readInviteSession()); }, []);
  const books = numberedMenuBooks(mode, invite);
  const book = bookBySlug(params.section);
  const code = book ? books.find((x) => x.book.slug === book.slug)?.n : null;

  if (!book) {
    return (
      <div className="play">
        <p className="text-muted">Unknown playbook. Jump by menu:</p>
        <div className="play-jump" style={{ marginTop: 16 }}>
          {books.map((x) => (
            <Link key={x.book.slug} href={`/playbook/${x.book.slug}`}>{x.n} {x.menu.label}</Link>
          ))}
        </div>
      </div>
    );
  }

  const first = book.steps[0];

  return (
    <div className="play">
      <div className="play-kicker">Playbook {code ?? "—"}</div>
      <h1 className="play-title">{code ? `${code}  ${book.title}` : book.title}</h1>
      <p className="play-lede">
        Operating playbooks for every sidebar menu. AI suggests; a person decides. Tax numbers still come from GMT24-CALC.
      </p>

      <div className="play-grid" aria-label="Jump to a menu playbook">
        {books.map((x) => (
          <Link
            key={x.book.slug}
            href={`/playbook/${x.book.slug}`}
            className={`play-cell${x.book.slug === book.slug ? " on" : ""}`}
            title={`${x.n} ${x.menu.label}`}
          >
            {x.n}
          </Link>
        ))}
      </div>

      <article className="play-card">
        <header className="play-card-head">
          <div>
            <h2>{book.menu}</h2>
            <p className="text-muted" style={{ margin: "6px 0 0" }}>{book.summary}</p>
          </div>
          <span className="tag tag-outline">Owner · {book.owner}</span>
        </header>

        <section className="play-law">
          <div className="play-law-kicker">The law — why this menu exists</div>
          <p>{book.law}</p>
        </section>

        <div className="play-split">
          <div>
            <div className="play-law-kicker">AI suggests</div>
            <p>{book.aiSuggests}</p>
          </div>
          <div>
            <div className="play-law-kicker">You decide</div>
            <p>{book.youDecide}</p>
          </div>
        </div>

        <ol className="play-steps">
          {book.steps.map((s) => (
            <li key={`${s.n}-${s.title}`}>
              <span className="play-step-n">{s.n}</span>
              <div>
                <h4>{s.title}</h4>
                <p className="text-muted">{s.body}</p>
              </div>
              <Link href={s.href} className="btn btn-primary play-go">Go</Link>
            </li>
          ))}
        </ol>

        <div className="play-card-foot">
          {book.href && (
            <Link href={book.href} className="btn btn-secondary">Open {book.menu}</Link>
          )}
          {first && first.href !== book.href && (
            <Link href={first.href} className="btn btn-ghost">{first.hrefLabel}</Link>
          )}
        </div>
      </article>

      <section className="play-jump-wrap">
        <div className="play-law-kicker">Jump by menu</div>
        <div className="play-jump">
          {books.map((x) => (
            <Link
              key={`${x.menu.group}:${x.menu.href}`}
              href={`/playbook/${x.book.slug}`}
              className={x.book.slug === book.slug ? "current" : undefined}
            >
              {x.n} {x.menu.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
