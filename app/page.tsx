"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Scale } from "lucide-react";
import { useStore } from "@/lib/store";
import { ModeToggle } from "@/components/ModeToggle";
import type { ProductMode } from "@/lib/model";

export default function LoginPage() {
  const { login, authed, ready } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("m.sato@aetherion.com");
  const [password, setPassword] = useState("demo1234");
  const [mode, setMode] = useState<ProductMode>("inhouse");

  useEffect(() => {
    if (ready && authed) router.replace("/overview");
  }, [ready, authed, router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login(mode);
    router.push(mode === "advisor" ? "/clients" : "/overview");
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", display: "flex", alignItems: "baseline", gap: 10 }}>
          GMT24<span style={{ width: 14, height: 14, background: "var(--color-bg)", display: "block" }} />
        </div>
        <div>
          <div className="login-headline">
            From financial data<br />to Pillar Two<br />compliance.
          </div>
          <p style={{ marginTop: 24, maxWidth: "48ch", fontSize: 15, lineHeight: 1.5, opacity: 0.94 }}>
            An AI-powered Global Minimum Tax operating system. AI maps and explains. A deterministic engine calculates. Every number is rule-versioned and traceable to source.
          </p>
        </div>
        <div style={{ display: "flex", gap: 28, borderTop: "2px solid color-mix(in srgb, #ffffff 45%, transparent)", paddingTop: 20, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", flexWrap: "wrap" }}>
          <div><div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>€14.8M</div>Demo top-up</div>
          <div><div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>48</div>Jurisdictions</div>
          <div><div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>212</div>Entities</div>
        </div>
      </div>
      <div className="login-form">
        <form onSubmit={onSubmit} style={{ width: "min(400px,100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-accent)" }}>Sign in</div>
            <ModeToggle compact />
          </div>
          <h2 style={{ margin: "0 0 4px" }}>Choose operating mode</h2>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 22 }}>Both modes run the identical calculation engine, rulebook and GIR output. The mode never changes the numbers.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
            <button
              type="button"
              onClick={() => { setMode("inhouse"); setEmail("m.sato@aetherion.com"); }}
              className="panel"
              style={{ padding: 14, textAlign: "left", cursor: "pointer", borderColor: mode === "inhouse" ? "var(--color-accent)" : undefined, background: mode === "inhouse" ? "var(--color-accent-100)" : undefined }}
            >
              <Building2 size={18} />
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, marginTop: 8 }}>In-house team</div>
              <div className="text-muted" style={{ fontSize: 12 }}>One MNE group. Your tax function prepares, reviews and files. Advisors enter as time-boxed guests.</div>
            </button>
            <button
              type="button"
              onClick={() => { setMode("advisor"); setEmail("a.rivera@7l-advisory.com"); }}
              className="panel"
              style={{ padding: 14, textAlign: "left", cursor: "pointer", borderColor: mode === "advisor" ? "var(--color-accent)" : undefined, background: mode === "advisor" ? "var(--color-accent-100)" : undefined }}
            >
              <Scale size={18} />
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, marginTop: 8 }}>Advisor firm</div>
              <div className="text-muted" style={{ fontSize: 12 }}>Multi-client portfolio. Same engine — different scope, roles and approval chain.</div>
            </button>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Work email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 22 }}>
            <label>Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            Enter {mode === "advisor" ? "advisory workspace" : "group workspace"} <ArrowRight size={18} />
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12 }}>
            <span className="text-muted">SSO · MFA · entity-level ACL</span>
            <span className="text-muted">Demo / demo1234</span>
          </div>
        </form>
      </div>
    </div>
  );
}
