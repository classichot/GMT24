"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { THAI_PACK } from "@/lib/thailand";

const ITEMS = [
  { href: "/thailand", label: "Pack" },
  { href: "/thailand/liability", label: "Liability" },
  { href: "/thailand/scope", label: "Scope" },
  { href: "/thailand/entities", label: "Situs" },
  { href: "/thailand/sbie", label: "SBIE" },
  { href: "/thailand/fx", label: "BOT FX" },
  { href: "/thailand/filing", label: "Filing" },
  { href: "/thailand/boi", label: "Optimizer" },
  { href: "/thailand/gap", label: "OECD vs RD" },
  { href: "/thailand/audit", label: "Defence" },
];

export function ThaiPackBar() {
  const path = usePathname();
  return (
    <div className="flow-bar">
      <nav className="flow-steps" aria-label="Thailand Jurisdiction Pack">
        {ITEMS.map((s) => (
          <Link key={s.href} href={s.href} className={path === s.href ? "on" : ""}>
            {s.label}
          </Link>
        ))}
      </nav>
      <span className="tag tag-warn">{THAI_PACK.coverage.headline}</span>
    </div>
  );
}
