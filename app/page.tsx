"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { ModeToggle } from "@/components/ModeToggle";
import type { ProductMode } from "@/lib/model";

export default function LoginPage() {
  const { login, authed, ready, mode: sessionMode } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("m.sato@aetherion.com");
  const [password, setPassword] = useState("demo1234");
  const [mode, setMode] = useState<ProductMode>("inhouse");

  useEffect(() => {
    if (ready && authed) router.replace(sessionMode === "advisor" ? "/clients" : "/overview");
  }, [ready, authed, sessionMode, router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login(mode);
    router.push(mode === "advisor" ? "/clients" : "/overview");
  }

  return (
    <div className="login-split">
      <section className="login-pane login-hero">
        <header className="login-pane-head">
          <div>
            <div className="login-mark">
              GMT24<span />
            </div>
            <span className="login-kicker">Global Minimum Tax operating system</span>
          </div>
        </header>
        <div className="login-pane-body">
          <h1 className="login-headline">
            Source data → AI mapping → rules → calculation → explanation → GIR → audit.
          </h1>
          <p className="login-lede">
            A deterministic Pillar Two engine, rule-versioned and traceable to the ledger. AI handles messy data, mapping, review and explanation — never the arithmetic.
          </p>
        </div>
        <footer className="login-pane-foot">
          <div className="login-stats">
            <div>
              <strong>$14.8M</strong>
              <span>Demo top-up</span>
            </div>
            <div>
              <strong>48</strong>
              <span>Jurisdictions</span>
            </div>
            <div>
              <strong>212</strong>
              <span>Entities</span>
            </div>
          </div>
        </footer>
      </section>

      <section className="login-pane login-auth">
        <header className="login-pane-head">
          <div className="login-kicker-ghost">Sign in</div>
          <ModeToggle compact />
        </header>
        <div className="login-pane-body">
          <form className="login-card" onSubmit={onSubmit}>
            <h2>Choose operating mode</h2>
            <p className="text-muted login-card-note">
              Both modes run the identical calculation engine, rulebook and GIR output. The mode never changes the numbers.
            </p>
            <div className="login-modes">
              <button
                type="button"
                className={`login-mode${mode === "inhouse" ? " on" : ""}`}
                onClick={() => { setMode("inhouse"); setEmail("m.sato@aetherion.com"); }}
              >
                <Building2 size={18} />
                <strong>In-house team</strong>
                <span>One MNE group. Your tax function prepares, reviews and files.</span>
              </button>
              <button
                type="button"
                className={`login-mode${mode === "advisor" ? " on" : ""}`}
                onClick={() => { setMode("advisor"); setEmail("a.rivera@7l-advisory.com"); }}
              >
                <Scale size={18} />
                <strong>Advisor firm</strong>
                <span>Multi-client portfolio. Same engine — different roles and approval chain.</span>
              </button>
            </div>
            <div className="field">
              <label>Work email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              Enter {mode === "advisor" ? "advisory workspace" : "group workspace"} <ArrowRight size={18} />
            </button>
          </form>
        </div>
        <footer className="login-pane-foot login-meta">
          <span>SSO · MFA · entity-level ACL</span>
          <span>Demo / demo1234</span>
        </footer>
      </section>
    </div>
  );
}
