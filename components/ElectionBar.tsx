"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OECD_ELEC_URLS } from "@/lib/elections";

const ITEMS = [
  { href: "/elections", label: "Election engine" },
  { href: "/optimize", label: "Optimize GloBE" },
  { href: "/years", label: "Year record" },
  { href: "/playbook/elections", label: "Playbook" },
];

export function ElectionBar() {
  const path = usePathname();
  return (
    <div className="flow-bar">
      <nav className="flow-steps" aria-label="Election & Scenario Engine">
        {ITEMS.map((s) => (
          <Link key={s.href} href={s.href} className={path === s.href ? "on" : ""}>
            {s.label}
          </Link>
        ))}
      </nav>
      <a className="tag tag-accent" href={OECD_ELEC_URLS.commentary} target="_blank" rel="noreferrer">
        OECD Commentary 2026
      </a>
    </div>
  );
}
