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
  HelpCircle,
  History,
  Landmark,
  LayoutGrid,
  Link2,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  ScanLine,
  Scale,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Upload,
  X,
} from "lucide-react";
import { DATA, ADVISOR_USER } from "@/lib/model";
import { SEEDS } from "@/lib/seeds";
import { useStore } from "@/lib/store";
import { ModeToggle } from "@/components/ModeToggle";
import { Copilot } from "@/components/Copilot";
import { AuditTrail } from "@/components/AuditTrail";
import { Amount } from "@/components/Amount";
import { StartEngage } from "@/components/StartEngage";
import { MenuGuide } from "@/components/MenuGuide";
import { AiMenuBadge, AiReadyBadge } from "@/components/AiReadyBadge";
import { AiProvider, useAi } from "@/components/AiProvider";
import { useCalc } from "@/lib/useCalc";
import { useXray } from "@/lib/useXray";
import { changeAlert } from "@/lib/packAmendments";
import { bookBySlug, bookForMenu } from "@/lib/menuPlaybooks";
import { formatExpiry, hoursLeft, readInviteSession } from "@/lib/invite";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const NAV = [
  { group: "Overview", items: [
    { href: "/overview", label: "Global dashboard", icon: LayoutGrid },
    { href: "/etr-map", label: "ETR map", icon: Map },
    { href: "/exposure", label: "Top-up exposure", icon: Shield },
  ]},
  { group: "Group", items: [
    { href: "/clients", label: "Clients", icon: Building2, advisor: true },
    { href: "/group", label: "Group structure", icon: GitBranch },
    { href: "/entities", label: "Entities", icon: Building2 },
    { href: "/graph", label: "Ownership graph", icon: Globe },
  ]},
  { group: "Data", items: [
    { href: "/data", label: "Data Hub", icon: Upload },
    { href: "/mapping", label: "Account mapping", icon: Sparkles },
    { href: "/quality", label: "Data quality", icon: Database },
    { href: "/requests", label: "Data requests", icon: FileText },
  ]},
  { group: "Assurance", items: [
    { href: "/xray", label: "Pillar Two X-Ray", icon: ScanLine, ai: true },
    { href: "/xray/confirm", label: "Confirmations", icon: ClipboardList, ai: true },
  ]},
  { group: "Pillar Two", items: [
    { href: "/scope", label: "Scope", icon: Scale },
    { href: "/safe-harbours", label: "Safe harbours", icon: Shield },
    { href: "/globe-income", label: "GloBE income", icon: FileText },
    { href: "/fx", label: "FX / FANIL GAAP", icon: Scale },
    { href: "/covered-taxes", label: "Covered taxes", icon: FileText },
    { href: "/deferred-tax", label: "Deferred tax", icon: Timer },
    { href: "/etr", label: "ETR", icon: Map },
    { href: "/sbie", label: "SBIE", icon: Scale },
    { href: "/top-up", label: "Top-up tax", icon: Shield },
    { href: "/allocation", label: "QDMTT / IIR / UTPR", icon: GitBranch },
  ]},
  { group: "Elections & Optimizer", items: [
    { href: "/elections", label: "Election engine", icon: SlidersHorizontal },
    { href: "/optimize", label: "Optimize GloBE", icon: Sparkles },
    { href: "/years", label: "Year record", icon: Timer },
  ]},
  { group: "Thailand", items: [
    { href: "/thailand", label: "Jurisdiction pack", icon: Landmark },
    { href: "/thailand/liability", label: "Liability dashboard", icon: Shield },
    { href: "/thailand/filing", label: "Filing command", icon: Check },
    { href: "/thailand/boi", label: "BOI Optimizer", icon: Sparkles },
    { href: "/thailand/gap", label: "OECD vs RD gap", icon: GitBranch },
    { href: "/thailand/audit", label: "Audit defence", icon: FileText },
  ]},
  { group: "Incentives", items: [
    { href: "/incentives", label: "Tax incentives", icon: Sparkles },
    { href: "/thailand/boi", label: "BOI Optimizer", icon: Sparkles },
  ]},
  { group: "Forecast", items: [
    { href: "/simulator", label: "Simulator", icon: Sparkles },
    { href: "/forecast", label: "Forecast", icon: LayoutGrid },
  ]},
  { group: "Compliance", items: [
    { href: "/gir", label: "GIR", icon: FileText },
    { href: "/filings", label: "Filing matrix", icon: Check },
    { href: "/notifications", label: "Notifications", icon: FileText },
    { href: "/archive", label: "Filing archive", icon: Database },
  ]},
  { group: "Review", items: [
    { href: "/review-guide", label: "Review guide", icon: ClipboardList },
    { href: "/issues", label: "Issues", icon: Shield },
    { href: "/audit", label: "Audit trail", icon: GitBranch },
    { href: "/evidence", label: "Evidence", icon: FileText },
    { href: "/evidence-history", label: "Evidence history", icon: History },
    { href: "/approvals", label: "Approvals", icon: Check },
    { href: "/host", label: "Host desk", icon: Link2, inviteHide: true },
  ]},
  { group: "AI Co-Pilot", items: [
    { href: "/copilot", label: "Co-Pilot hub", icon: MessageSquare, ai: true },
    { href: "/quickscan", label: "Quick Scan", icon: ScanLine, ai: true },
    { href: "/trainer", label: "App Trainer", icon: BookOpen, ai: true },
    { href: "/reviewer", label: "Calculation Reviewer", icon: Check, ai: true },
    { href: "/strategy", label: "Strategy Simulator", icon: Sparkles, ai: true },
    { href: "/rehearsal", label: "Audit Rehearsal", icon: Shield, ai: true },
    { href: "/regwatch", label: "Regulatory Watch", icon: Globe, ai: true },
    { href: "/briefing", label: "CFO Briefing", icon: FileText, ai: true },
    { href: "/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/feedback", label: "Feedback", icon: MessageSquare, ai: true },
  ]},
  { group: "Intelligence", items: [
    { href: "/rulebook", label: "OECD rulebook", icon: BookOpen },
    { href: "/jurisdictions", label: "Jurisdiction rules", icon: Globe },
    { href: "/settings", label: "Settings", icon: Settings },
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
  "/onboard": ["Advisor mode", "New engagement"],
  "/group": ["Group", "Structure & scope"],
  "/entities": ["Group", "Constituent entities"],
  "/graph": ["Group", "Global Tax Graph"],
  "/data": ["Data Engine", "Data Hub"],
  "/mapping": ["Killer feature", "AI Smart Mapping"],
  "/quality": ["Data Engine", "Readiness & validation"],
  "/requests": ["Data Engine", "AI Data Gap Hunter"],
  "/xray": ["Killer feature", "Pillar Two X-Ray"],
  "/xray/confirm": ["Pillar Two X-Ray", "Smart confirmation workflow"],
  "/scope": ["Pillar Two", "Scope engine"],
  "/safe-harbours": ["Killer feature", "Safe Harbour Navigator"],
  "/globe-income": ["Pillar Two", "GloBE income"],
  "/fx": ["Pillar Two", "Locked FX & FANIL GAAP"],
  "/covered-taxes": ["Pillar Two", "Covered taxes"],
  "/deferred-tax": ["Killer feature", "Deferred Tax Intelligence"],
  "/etr": ["Pillar Two", "Jurisdictional ETR"],
  "/sbie": ["Pillar Two", "Substance-based income exclusion"],
  "/top-up": ["Pillar Two", "Top-up tax"],
  "/allocation": ["Pillar Two", "Who pays · where · why"],
  "/elections": ["Killer feature", "Election & Scenario Engine"],
  "/optimize": ["Killer feature", "Pillar Two Scenario Optimizer"],
  "/years": ["In-house close", "Year record & consistency"],
  "/thailand": ["Killer feature", "Thailand Jurisdiction Pack"],
  "/thailand/liability": ["Thailand", "Liability & filing orchestrator"],
  "/thailand/scope": ["Thailand", "Scope determination memorandum"],
  "/thailand/entities": ["Thailand", "Entity classification & situs"],
  "/thailand/sbie": ["Thailand", "Thai SBIE engine"],
  "/thailand/fx": ["Thailand", "BOT foreign-exchange engine"],
  "/thailand/filing": ["Thailand", "Filing command centre"],
  "/thailand/boi": ["Killer feature", "BOI–Pillar Two Incentive Optimizer"],
  "/thailand/audit": ["Thailand", "Audit defence book"],
  "/thailand/gap": ["Killer feature", "OECD vs Thai RD gap review"],
  "/incentives": ["Incentives", "BOI / tax incentive engine"],
  "/simulator": ["Killer feature", "GMT24 Simulator"],
  "/forecast": ["Forecast", "In-year Pillar Two"],
  "/gir": ["Compliance", "GloBE Information Return"],
  "/filings": ["Compliance", "Global filing matrix"],
  "/notifications": ["Compliance", "Notifications"],
  "/archive": ["Compliance", "Filing archive"],
  "/issues": ["Review", "Issues & AI reviewer"],
  "/review-guide": ["Review", "App reviewer walkthrough"],
  "/audit": ["Killer feature", "Calculation-to-ledger trail"],
  "/evidence": ["Review", "Evidence locker"],
  "/evidence-history": ["Review", "Evidence history"],
  "/approvals": ["Review", "Preparer / reviewer"],
  "/copilot": ["AI Co-Pilot", "Ask GMT24"],
  "/quickscan": ["AI Co-Pilot", "Pillar Two Quick Scan"],
  "/trainer": ["AI Co-Pilot", "App Trainer"],
  "/reviewer": ["AI Co-Pilot", "Calculation Reviewer"],
  "/strategy": ["AI Co-Pilot", "Strategy Simulator"],
  "/rehearsal": ["AI Co-Pilot", "Audit Rehearsal"],
  "/regwatch": ["AI Co-Pilot", "Regulatory Impact Watch"],
  "/briefing": ["AI Co-Pilot", "CFO Briefing"],
  "/tasks": ["AI Co-Pilot", "Tasks"],
  "/feedback": ["AI Co-Pilot", "Feedback"],
  "/rulebook": ["Killer feature", "GMT24 Global Rulebook"],
  "/jurisdictions": ["Intelligence", "Jurisdiction packs"],
  "/settings": ["Workspace", "Settings"],
};

function isActive(path: string, href: string) {
  if (href === "/thailand") return path === "/thailand";
  if (href === "/xray") return path === "/xray";
  return path === href || path.startsWith(href + "/");
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AiProvider>
      <Shell>{children}</Shell>
    </AiProvider>
  );
}

const DEMO_GROUPS = Object.values(SEEDS).map((s) => s.group);

const NAV_W_KEY = "gmt24_nav_w";
export const NAV_W_DEFAULT = 248;
export const NAV_W_MIN = 200;
export const NAV_W_MAX = 440;
export const NAV_W_STEP = 16;

export function clampNavWidth(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return NAV_W_DEFAULT;
  return Math.min(NAV_W_MAX, Math.max(NAV_W_MIN, Math.round(v)));
}

/** Sidebar width the user last dragged to. Persisted per browser; drag the right edge, arrow keys nudge, double-click resets. */
function useNavWidth() {
  const [width, setWidth] = useState(NAV_W_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const live = useRef(NAV_W_DEFAULT);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAV_W_KEY);
      if (stored) {
        const w = clampNavWidth(stored);
        live.current = w;
        setWidth(w);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const commit = useCallback((w: number) => {
    const v = clampNavWidth(w);
    live.current = v;
    setWidth(v);
    try {
      if (v === NAV_W_DEFAULT) localStorage.removeItem(NAV_W_KEY);
      else localStorage.setItem(NAV_W_KEY, String(v));
    } catch {
      /* private mode */
    }
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    const startX = e.clientX;
    const startW = live.current;
    handle.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => {
      const v = clampNavWidth(startW + (ev.clientX - startX));
      live.current = v;
      setWidth(v);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      setDragging(false);
      commit(live.current);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }, [commit]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); commit(live.current - NAV_W_STEP); }
    else if (e.key === "ArrowRight") { e.preventDefault(); commit(live.current + NAV_W_STEP); }
    else if (e.key === "Home") { e.preventDefault(); commit(NAV_W_MIN); }
    else if (e.key === "End") { e.preventDefault(); commit(NAV_W_MAX); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commit(NAV_W_DEFAULT); }
  }, [commit]);

  const reset = useCallback(() => commit(NAV_W_DEFAULT), [commit]);

  return { width, dragging, onPointerDown, onKeyDown, reset };
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { model } = useAi();
  const llmLive = model.configured && model.reachable;
  const { logout, toast, navOpen, setNavOpen, mode, group, setGroupId, flash, setCopilotOpen, copilotOpen, activeFy, packChanges } = useStore();
  const user = mode === "advisor" ? ADVISOR_USER : DATA.inhouseUser;
  const { t } = useCalc();
  const { stop } = useXray();
  const packAlert = changeAlert(packChanges);
  const [invite, setInvite] = useState<ReturnType<typeof readInviteSession>>(null);
  const inviteHours = invite ? hoursLeft(invite.exp) : 0;
  const nav = useNavWidth();
  // Menu guide: `href` null = explain the current screen; a value = a menu picked from the sidebar.
  const [guide, setGuide] = useState<{ open: boolean; href: string | null }>({ open: false, href: null });
  const openGuide = useCallback((href: string | null) => {
    setGuide((g) => (g.open && (g.href ?? path) === (href ?? path) ? { open: false, href: null } : { open: true, href }));
    setNavOpen(false);
  }, [path, setNavOpen]);

  useEffect(() => { setNavOpen(false); }, [path, setNavOpen]);
  // Once you arrive on a screen, the guide follows the screen you are on.
  useEffect(() => { setGuide((g) => (g.href ? { ...g, href: null } : g)); }, [path]);
  useEffect(() => { setInvite(readInviteSession()); }, [path]);

  const book = path.startsWith("/playbook/")
    ? bookBySlug(path.slice("/playbook/".length))
    : bookForMenu(path);
  const [kicker, title] = path.startsWith("/playbook/") && book
    ? (["Playbook", book.title] as [string, string])
    : TITLES[path] || (["GMT24", "Pillar Two OS"] as [string, string]);

  return (
    <div className="shell">
      <div className={`sidebar-backdrop${navOpen ? " open" : ""}`} onClick={() => setNavOpen(false)} />
      <aside className={`sidebar${navOpen ? " open" : ""}${nav.dragging ? " resizing" : ""}`} style={{ width: nav.width }}>
        <div style={{ padding: "18px 16px 14px", borderBottom: "2px solid var(--color-divider)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              GMT24<span style={{ width: 14, height: 14, background: "var(--color-accent)", display: "block" }} />
              <AiReadyBadge compact />
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
        {mode === "inhouse" && !invite && DEMO_GROUPS.length > 1 && (
          <label className="group-switch" title="Open another demo group">
            <span>Demo group</span>
            <select
              className="input"
              value={DEMO_GROUPS.some((g) => g.id === group.id) ? group.id : ""}
              onChange={(e) => {
                const id = e.target.value;
                if (!id || id === group.id) return;
                setGroupId(id);
                setNavOpen(false);
                flash(`${SEEDS[id].group.name} open`);
                router.push("/overview");
              }}
            >
              {!DEMO_GROUPS.some((g) => g.id === group.id) && <option value="">{group.name}</option>}
              {DEMO_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>{g.name} · {g.upeIso} UPE</option>
              ))}
            </select>
          </label>
        )}
        {mode === "advisor" && !invite && (
          <div className="sidebar-start">
            <div className="sidebar-start-kicker">Start here</div>
            <StartEngage block />
          </div>
        )}
        <nav style={{ flex: 1, overflow: "auto", padding: "10px 8px" }}>
          {NAV.flatMap((g) => {
            const items = g.items.filter((i) => {
              if ("advisor" in i && i.advisor && mode !== "advisor") return false;
              if ("inviteHide" in i && i.inviteHide && invite) return false;
              return true;
            });
            return items.length ? [{ g, items }] : [];
          }).map(({ g, items }, gi) => {
            const n = gi + 1;
            return (
              <div key={g.group}>
                <div className="nav-group"><span className="nav-num">{n}</span>{g.group}</div>
                {items.map((item, ii) => {
                  const Icon = item.icon;
                  const pb = bookForMenu(item.href);
                  const pbHref = pb ? `/playbook/${pb.slug}` : "/playbook/overview";
                  return (
                    <div key={`${g.group}:${item.href}`} className="nav-row">
                      <Link href={item.href} onClick={() => setNavOpen(false)} className={`nav-btn${isActive(path, item.href) ? " active" : ""}`}>
                        <span className="nav-num">{n}.{ii + 1}</span>
                        <Icon size={15} />
                        <span className="nav-label">{item.label}</span>
                        {"ai" in item && item.ai ? <AiMenuBadge live={llmLive} /> : null}
                      </Link>
                      <Link
                        href={pbHref}
                        onClick={() => setNavOpen(false)}
                        className={`nav-pb${path === pbHref ? " on" : ""}`}
                        title={`${item.label} playbook`}
                        aria-label={`${item.label} playbook`}
                      >
                        PB
                      </Link>
                      <button
                        type="button"
                        className={`nav-help${guide.open && (guide.href ?? path) === item.href ? " on" : ""}`}
                        title={`What is ${item.label} for?`}
                        aria-label={`What is ${item.label} for?`}
                        onClick={() => openGuide(item.href)}
                      >
                        <HelpCircle size={13} />
                      </button>
                    </div>
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
        <div
          className="sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize menu"
          aria-valuemin={NAV_W_MIN}
          aria-valuemax={NAV_W_MAX}
          aria-valuenow={nav.width}
          title="Drag to resize the menu · double-click to reset"
          tabIndex={0}
          onPointerDown={nav.onPointerDown}
          onKeyDown={nav.onKeyDown}
          onDoubleClick={nav.reset}
        />
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-accent)" }}>{kicker}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <h3 style={{ margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3>
              {book && (
                <Link
                  href={`/playbook/${book.slug}`}
                  className={`title-help${path === `/playbook/${book.slug}` ? " on" : ""}`}
                  title={`${book.menu} playbook`}
                >
                  PB
                  <span className="header-hide-sm">Playbook</span>
                </Link>
              )}
              <button
                type="button"
                className={`title-help${guide.open && !guide.href ? " on" : ""}`}
                title="What is this menu for?"
                aria-label="What is this menu for?"
                aria-expanded={guide.open && !guide.href}
                onClick={() => openGuide(null)}
              >
                <HelpCircle size={15} />
                <span className="header-hide-sm">What is this menu?</span>
              </button>
            </div>
          </div>
          <span className={`tag ${mode === "advisor" ? "tag-outline" : "tag-accent"} header-hide-sm`}>{mode === "advisor" ? "Advisor" : "In-house"}</span>
          <span className="tag tag-outline header-hide-sm">{activeFy}</span>
          {mode === "advisor" && !invite && (
            <span className="header-hide-sm">
              <StartEngage />
            </span>
          )}
          <ModeToggle compact />
          {!invite && (
            <Link href="/host" className="btn btn-ghost header-hide-sm"><Link2 size={16} />Desk</Link>
          )}
          <button className="btn btn-secondary header-hide-sm" onClick={() => setCopilotOpen(!copilotOpen)}><MessageSquare size={16} />Ask GMT24</button>
          <Link href="/gir" className="btn btn-primary header-hide-sm"><FileText size={16} />GIR pack</Link>
        </header>
        {invite && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "8px 16px", borderBottom: "2px solid var(--color-divider)", background: "var(--color-surface)", fontSize: 12, fontWeight: 700, flexWrap: "wrap" }}>
            <Timer size={13} />
            Demo review link · {group.name} · until {formatExpiry(invite.exp)} · ~{Math.max(1, Math.ceil(inviteHours / 24))}d left
            <Link href="/review-guide" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Review guide</Link>
          </div>
        )}
        {packAlert && (
          <Link
            href="/jurisdictions"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "8px 16px", borderBottom: "2px solid var(--color-divider)", background: "color-mix(in srgb, var(--color-hot) 16%, var(--color-surface))", fontSize: 12, fontWeight: 700, flexWrap: "wrap", textDecoration: "none", color: "inherit" }}
          >
            <Globe size={13} />
            {packAlert}
            <span className="tag tag-outline" style={{ fontSize: 10 }}>Review packs</span>
          </Link>
        )}
        {stop.blocked && (
          <Link
            href="/xray"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "8px 16px", borderBottom: "2px solid var(--color-divider)", background: "color-mix(in srgb, var(--color-hot) 16%, var(--color-surface))", fontSize: 12, fontWeight: 700, flexWrap: "wrap", textDecoration: "none", color: "inherit" }}
          >
            <ScanLine size={13} />
            {stop.label}
            <span className="tag tag-outline" style={{ fontSize: 10 }}>Open X-Ray</span>
          </Link>
        )}
        {guide.open && <MenuGuide href={guide.href} onClose={() => setGuide({ open: false, href: null })} />}
        <div className="workspace">
          <main className="page-main">{children}</main>
          <Copilot />
        </div>
      </div>

      <nav className="bottom-nav no-print">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={isActive(path, t.href) ? "active" : ""}>
              <Icon size={18} />
              <span className="nav-num">{i + 1}</span>
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
