"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BookOpen, ClipboardList, MessageSquare, X } from "lucide-react";
import { catalogForPath } from "@/lib/ai/catalog";
import { useAi } from "@/components/AiProvider";
import { useStore } from "@/lib/store";

/**
 * Inline guide for a menu. Opens directly under the page title so the
 * explanation sits next to the screen it describes; the Copilot is one tap
 * away for follow-up questions on the same menu.
 */
export function MenuGuide({ href, onClose }: { href: string | null; onClose: () => void }) {
  const path = usePathname();
  const ai = useAi();
  const { setCopilotOpen } = useStore();
  const target = href ?? path;
  const { screen, book } = catalogForPath(target);
  const here = target === path || (!!screen && screen.href === path);

  if (!screen && !book) {
    return (
      <section className="menu-guide" aria-label="Menu guide">
        <div className="menu-guide-head">
          <div>
            <div className="menu-guide-kicker">This menu</div>
            <h4>No guide for this screen yet</h4>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close guide"><X size={16} /></button>
        </div>
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Ask GMT24 with the button on the right and it will answer from the product catalog.</p>
      </section>
    );
  }

  const title = screen?.title ?? book!.menu;
  const purpose = screen?.purpose ?? book!.summary;
  const askAbout = () => {
    setCopilotOpen(true);
    ai.explainMenu(screen?.href ?? book?.steps[0]?.href ?? target);
  };

  return (
    <section className="menu-guide" aria-label={`Guide · ${title}`}>
      <div className="menu-guide-head">
        <div style={{ minWidth: 0 }}>
          <div className="menu-guide-kicker">{screen?.module ?? "Playbook"} · this menu</div>
          <h4>{title}</h4>
        </div>
        <div className="stack-actions">
          {!here && screen && (
            <Link href={screen.href} className="btn btn-primary" style={{ fontSize: 12, padding: "6px 12px" }}>Open {screen.title}<ArrowRight size={14} /></Link>
          )}
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={askAbout}><MessageSquare size={14} />Ask GMT24 about this</button>
          <button className="icon-btn" onClick={onClose} aria-label="Close guide" title="Close guide"><X size={16} /></button>
        </div>
      </div>

      <p className="menu-guide-purpose">{purpose}</p>

      <div className="menu-guide-grid">
        {screen && screen.actions.length > 0 && (
          <div className="menu-guide-col">
            <div className="menu-guide-label">What you can do here</div>
            <ul>
              {screen.actions.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        )}
        {screen && screen.fields.length > 0 && (
          <div className="menu-guide-col">
            <div className="menu-guide-label">Terms on this screen</div>
            <dl>
              {screen.fields.map((f) => (
                <div key={f.term}>
                  <dt>{f.term}</dt>
                  <dd>{f.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {book && (
          <div className="menu-guide-col">
            <div className="menu-guide-label"><ClipboardList size={12} /> {book.menu} playbook · {book.steps.length} steps</div>
            <ol>
              {book.steps.map((s) => (
                <li key={s.n}>
                  <Link href={s.href} className={s.href === path ? "current" : undefined}>{s.title}</Link>
                  {s.href === path && <span className="tag tag-accent" style={{ marginLeft: 6, fontSize: 9 }}>you are here</span>}
                </li>
              ))}
            </ol>
            <Link href={`/playbook/${book.slug}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 6px", marginTop: 4 }}><BookOpen size={14} />Open the full playbook</Link>
          </div>
        )}
      </div>
    </section>
  );
}
