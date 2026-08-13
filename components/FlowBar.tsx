"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Suspense } from "react";

const STEPS = [
  { href: "/overview", label: "Dashboard" },
  { href: "/etr-map", label: "ETR map" },
  { href: "/etr", label: "ETR" },
  { href: "/top-up", label: "Top-up" },
  { href: "/allocation", label: "Allocation" },
  { href: "/gir", label: "GIR" },
  { href: "/filings", label: "Filings" },
  { href: "/approvals", label: "Approve" },
];

function BarInner({ iso }: { iso?: string }) {
  const path = usePathname();
  const q = useSearchParams();
  const selected = iso ?? q.get("iso") ?? undefined;
  const suffix = selected ? `?iso=${selected}` : "";
  const idx = Math.max(0, STEPS.findIndex((s) => path === s.href || path.startsWith(s.href + "/")));
  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : null;
  const keepIso = (href: string) =>
    ["/etr-map", "/etr", "/top-up", "/allocation"].includes(href) && selected ? `${href}${suffix}` : href;

  return (
    <div className="flow-bar">
      <nav className="flow-steps" aria-label="Calculation flow">
        {STEPS.map((s, i) => (
          <Link key={s.href} href={keepIso(s.href)} className={i === idx ? "on" : i < idx ? "done" : ""}>
            {s.label}
          </Link>
        ))}
      </nav>
      <div className="stack-actions">
        {prev && (
          <Link href={keepIso(prev.href)} className="btn btn-secondary">
            <ArrowLeft size={14} /> {prev.label}
          </Link>
        )}
        {next && (
          <Link href={keepIso(next.href)} className="btn btn-primary">
            {next.label} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

export function FlowBar({ iso }: { iso?: string }) {
  return (
    <Suspense>
      <BarInner iso={iso} />
    </Suspense>
  );
}
