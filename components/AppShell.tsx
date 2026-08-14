"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  Check,
  ClipboardList,
  Database,
  FileText,
  GitBranch,
  Globe,
  LayoutGrid,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Timer,
  Upload,
  X,
} from "lucide-react";
import { ADVISOR_USER, GROUPS, INHOUSE_USER } from "@/lib/model";
import { useStore } from "@/lib/store";
import { ModeToggle } from "@/components/ModeToggle";
import { Copilot } from "@/components/Copilot";
import { AuditTrail } from "@/components/AuditTrail";
import { Amount } from "@/components/Amount";
import { useCalc } from "@/lib/useCalc";
import { PLAYBOOKS } from "@/lib/playbooks";
import type { ReactNode } from "react";
import { useEffect } from "react";

const NAV = [
  { group: "Overview", items: [
    { href: "/overview", label: "Global dashboard", icon: LayoutGrid },
    { href: "/etr-map", label: "ETR map", icon: Map },
    { href: "/exposure", label: "Top-up exposure", icon: Shield },
    { href: "/playbook/overview", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Group", items: [
    { href: "/clients", label: "Clients", icon: Building2, advisor: true },
    { href: "/group", label: "Group structure", icon: GitBranch },
    { href: "/entities", label: "Entities", icon: Building2 },
    { href: "/graph", label: "Ownership graph", icon: Globe },
    { href: "/playbook/group", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Data", items: [
    { href: "/data", label: "Data Hub", icon: Upload },
    { href: "/mapping", label: "Account mapping", icon: Sparkles },
    { href: "/quality", label: "Data quality", icon: Database },
    { href: "/requests", label: "Data requests", icon: FileText },
    { href: "/playbook/data", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Pillar Two", items: [
    { href: "/scope", label: "Scope", icon: Scale },
    { href: "/safe-harbours", label: "Safe harbours", icon: Shield },
    { href: "/globe-income", label: "GloBE income", icon: FileText },
    { href: "/covered-taxes", label: "Covered taxes", icon: FileText },
    { href: "/deferred-tax", label: "Deferred tax", icon: Timer },
    { href: "/etr", label: "ETR", icon: Map },
    { href: "/sbie", label: "SBIE", icon: Scale },
    { href: "/top-up", label: "Top-up tax", icon: Shield },
    { href: "/allocation", label: "QDMTT / IIR / UTPR", icon: GitBranch },
    { href: "/playbook/pillar-two", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Incentives", items: [
    { href: "/incentives", label: "Tax incentives", icon: Sparkles },
    { href: "/playbook/incentives", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Forecast", items: [
    { href: "/simulator", label: "Simulator", icon: Sparkles },
    { href: "/forecast", label: "Forecast", icon: LayoutGrid },
    { href: "/playbook/forecast", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Compliance", items: [
    { href: "/gir", label: "GIR", icon: FileText },
    { href: "/filings", label: "Filing matrix", icon: Check },
    { href: "/notifications", label: "Notifications", icon: FileText },
    { href: "/archive", label: "Filing archive", icon: Database },
    { href: "/playbook/compliance", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Review", items: [
    { href: "/issues", label: "Issues", icon: Shield },
    { href: "/audit", label: "Audit trail", icon: GitBranch },
    { href: "/evidence", label: "Evidence", icon: FileText },
    { href: "/approvals", label: "Approvals", icon: Check },
    { href: "/playbook/review", label: "Playbook", icon: ClipboardList },
  ]},
  { group: "Intelligence", items: [
    { href: "/copilot", label: "AI Copilot", icon: MessageSquare },
    { href: "/rulebook", label: "OECD rulebook", icon: BookOpen },
    { href: "/jurisdictions", label: "Jurisdiction rules", icon: Globe },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/playbook/intelligence", label: "Playbook", icon: ClipboardList },
  ]},
];

const TABS = [
  { href: "/overview", label: "Home", icon: LayoutGrid },
  { href: "/graph", label: "Graph", icon: Globe },
  { href: "/data", label: "Data", icon: Upload },
  { href: "/top-up", label: "Top-up", icon: Shield },
  { href: "/gir", label: "GIR", icon: FileText },
];

const TITLES: Record<string, [string, string]> = {
  "/overview": ["Global Minimum Tax", "Exposure"],
  "/etr-map": ["Overview", "Global ETR map"],
  "/exposure": ["Overview", "Top-up tax exposure"],
  "/clients": ["Advisor mode", "Client portfolio"],
  "/group": ["Group", "Structure & scope"],
  "/entities": ["Group", "Constituent entities"],
  "/graph": ["Group", "Global Tax Graph"],
  "/data": ["Data Engine", "Data Hub"],
  "/mapping": ["Killer feature", "AI Smart Mapping"],
  "/quality": ["Data Engine", "Readiness & validation"],
  "/requests": ["Data Engine", "AI Data Gap Hunter"],
  "/scope": ["Pillar Two", "Scope engine"],
  "/safe-harbours": ["Killer feature", "Safe Harbour Navigator"],
  "/globe-income": ["Pillar Two", "GloBE income"],
  "/covered-taxes": ["Pillar Two", "Covered taxes"],
  "/deferred-tax": ["Killer feature", "Deferred Tax Intelligence"],
  "/etr": ["Pillar Two", "Jurisdictional ETR"],
  "/sbie": ["Pillar Two", "Substance-based income exclusion"],
  "/top-up": ["Pillar Two", "Top-up tax"],
  "/allocation": ["Pillar Two", "Who pays · where · why"],
  "/incentives": ["Incentives", "BOI / tax incentive engine"],
  "/simulator": ["Killer feature", "GMT24 Simulator"],
  "/forecast": ["Forecast", "In-year Pillar Two"],
  "/gir": ["Compliance", "GloBE Information Return"],
  "/filings": ["Compliance", "Global filing matrix"],
  "/notifications": ["Compliance", "Notifications"],
  "/archive": ["Compliance", "Filing archive"],
  "/issues": ["Review", "Issues & AI reviewer"],
  "/audit": ["Killer feature", "Calculation-to-ledger trail"],
  "/evidence": ["Review", "Evidence locker"],
  "/approvals": ["Review", "Preparer / reviewer"],
  "/copilot": ["Intelligence", "Ask GMT24"],
  "/rulebook": ["Killer feature", "GMT24 Global Rulebook"],
  "/jurisdictions": ["Intelligence", "Jurisdiction packs"],
  "/settings": ["Workspace", "Settings"],
};

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { logout, toast, navOpen, setNavOpen, mode, groupId, setCopilotOpen, copilotOpen } = useStore();
  const user = mode === "advisor" ? ADVISOR_USER : INHOUSE_USER;
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
  const { t } = useCalc();

  useEffect(() => { setNavOpen(false); }, [path, setNavOpen]);

  const book = path.startsWith("/playbook/")
    ? PLAYBOOKS.find((p) => path === `/playbook/${p.slug}`)
    : null;
  const [kicker, title] = book
    ? (["Playbook", book.title] as [string, string])
    : TITLES[path] || (["GMT24", "Pillar Two OS"] as [string, string]);

  return (
    <div className="shell">
      <div className={`sidebar-backdrop${navOpen ? " open" : ""}`} onClick={() => setNavOpen(false)} />
      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <div style={{ padding: "18px 16px 14px", borderBottom: "2px solid var(--color-divider)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em", display: "flex", alignItems: "baseline", gap: 10 }}>
              GMT24<span style={{ width: 14, height: 14, background: "var(--color-accent)", display: "block" }} />
            </div>
            <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginTop: 4 }}>Global Minimum Tax OS</div>
          </div>
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <Link href={mode === "advisor" ? "/clients" : "/overview"} onClick={() => setNavOpen(false)} style={{ display: "block", padding: "12px 14px", borderBottom: "2px solid var(--color-divider)", background: "var(--color-surface)", textDecoration: "none", color: "inherit" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>{mode === "advisor" ? "Engagement" : "MNE group"}</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 13 }}>{group.name}</div>
          <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 2 }}>{group.fy} · <Amount n={t.topUp} audit={t.audit} compact /> top-up</div>
        </Link>
        <nav style={{ flex: 1, overflow: "auto", padding: "10px 8px" }}>
          {NAV.map((g) => {
            const items = g.items.filter((i) => !("advisor" in i && i.advisor) || mode === "advisor");
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <div className="nav-group">{g.group}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setNavOpen(false)} className={`nav-btn${isActive(path, item.href) ? " active" : ""}`}>
                      <Icon size={15} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <span style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>{mode === "advisor" ? "Advisor firm" : "In-house team"}</span>
          <span>Rule pack 2026.2</span>
          <span>Engine GMT24-CALC · deterministic</span>
          <div className="user-frame">
            <span style={{ width: 30, height: 30, flex: "none", background: "var(--color-neutral-300)", color: "var(--color-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: "var(--font-heading)", fontSize: 12 }}>{user.initials}</span>
            <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{user.name}</div>
              <div>{user.role}</div>
            </div>
            <button title="Sign out" onClick={() => { logout(); router.push("/"); }} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--color-neutral-600)", display: "inline-flex", width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-accent)" }}>{kicker}</div>
            <h3 style={{ margin: "2px 0 0" }}>{title}</h3>
          </div>
          <span className={`tag ${mode === "advisor" ? "tag-outline" : "tag-accent"} header-hide-sm`}>{mode === "advisor" ? "Advisor" : "In-house"}</span>
          <ModeToggle compact />
          <button className="btn btn-secondary header-hide-sm" onClick={() => setCopilotOpen(!copilotOpen)}><MessageSquare size={16} />Ask GMT24</button>
          <Link href="/gir" className="btn btn-primary header-hide-sm"><FileText size={16} />GIR pack</Link>
        </header>
        <div className="workspace">
          <main className="page-main">{children}</main>
          <Copilot />
        </div>
      </div>

      <nav className="bottom-nav no-print">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={isActive(path, t.href) ? "active" : ""}>
              <Icon size={18} />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <AuditTrail />
      {toast && (
        <div className="toast">
          <Check size={16} color="var(--color-accent-400)" />
          {toast}
        </div>
      )}
    </div>
  );
}
