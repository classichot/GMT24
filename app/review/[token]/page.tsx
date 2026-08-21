"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  formatExpiry,
  hoursLeft,
  readInviteSession,
  saveInviteSession,
  verifyInvite,
  type InvitePayload,
} from "@/lib/invite";

function Shell({ kicker, title, lede, children }: { kicker: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <div className="login-split">
      <section className="login-pane login-hero">
        <header className="login-pane-head">
          <div>
            <div className="login-mark">GMT24<span /></div>
            <span className="login-kicker">{kicker}</span>
          </div>
        </header>
        <div className="login-pane-body">
          <h1 className="login-headline">{title}</h1>
          <p className="login-lede">{lede}</p>
        </div>
      </section>
      <section className="login-pane login-auth">
        <header className="login-pane-head">
          <div className="login-kicker-ghost">Review link</div>
          <Link href="/" className="btn btn-ghost" style={{ fontSize: 12 }}>Public login</Link>
        </header>
        <div className="login-pane-body">
          <div className="login-card">{children}</div>
        </div>
      </section>
    </div>
  );
}

export default function ReviewInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { login, ready } = useStore();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "expired" | "revoked" | "invalid">("checking");
  const [payload, setPayload] = useState<InvitePayload | null>(null);
  const [raw, setRaw] = useState("");

  const rawToken = Array.isArray(token) ? token.join("/") : token || "";

  useEffect(() => {
    if (!ready) return;
    if (rawToken === "ended") {
      setState("expired");
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await verifyInvite(rawToken);
      if (cancelled) return;
      if (result.ok) {
        setPayload(result.payload);
        setRaw(result.token);
        setState("ok");
        return;
      }
      setPayload(result.payload ?? null);
      setState(result.reason);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, rawToken]);

  function enter() {
    if (!payload) return;
    saveInviteSession(payload, raw);
    login(payload.mode, { invite: true });
    router.push(payload.mode === "advisor" ? "/clients" : "/overview");
  }

  if (!ready || state === "checking") {
    return (
      <Shell kicker="Review link" title="Opening your review…" lede="Checking the time window on this link.">
        <p className="text-muted">One moment.</p>
      </Shell>
    );
  }

  if (state === "expired") {
    const when = payload?.exp ? formatExpiry(payload.exp) : "the end of the review window";
    return (
      <Shell
        kicker="Review link expired"
        title="This link is closed"
        lede="The review window has ended. GMT24 on this URL can no longer be opened. Ask 7L Advisory if you need a new link."
      >
        <p className="eyebrow" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Expired</p>
        <h2>Access ended</h2>
        <p className="text-muted login-card-note">This review link stopped working at {when}. Nothing was filed with any tax authority. Demo data stays only in the browser that used the link.</p>
      </Shell>
    );
  }

  if (state === "revoked") {
    return (
      <Shell
        kicker="Review link withdrawn"
        title="This link was cut off"
        lede="7L Advisory ended this review link before the window ran out."
      >
        <p className="eyebrow" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Unavailable</p>
        <h2>Link disabled</h2>
        <p className="text-muted login-card-note">Ask 7L for a new invite if you still need to look at GMT24.</p>
      </Shell>
    );
  }

  if (state !== "ok" || !payload) {
    return (
      <Shell
        kicker="Review link"
        title="This link is not valid"
        lede="The URL is incomplete or was copied wrong. Ask 7L Advisory to send the link again."
      >
        <p className="eyebrow" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Cannot open</p>
        <h2>Broken link</h2>
        <p className="text-muted login-card-note">Use the full URL from the email, including everything after /review/.</p>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 16 }}><Link href="/host">Host sign-in</Link> · 7L Advisory only</p>
      </Shell>
    );
  }

  const left = hoursLeft(payload.exp);
  const daysLeft = Math.max(1, Math.ceil(left / 24));
  const existing = readInviteSession();

  return (
    <Shell
      kicker="Advisor review"
      title="Continue your GMT24 review"
      lede={`This link still works until ${formatExpiry(payload.exp)} (about ${daysLeft} day${daysLeft === 1 ? "" : "s"} left). After that it will not open.`}
    >
      <p className="eyebrow" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{payload.label || "Aetherion Group demo"}</p>
      <h2>Welcome{existing ? " back" : ""}</h2>
      <p className="text-muted login-card-note">
        You are in a time-limited {payload.mode === "advisor" ? "advisor" : "in-house"} review. Open Aetherion Group. The engine calculated the figures; this is a demo, not a filing.
      </p>
      <button className="btn btn-primary btn-block" type="button" onClick={enter}>
        Enter {payload.mode === "advisor" ? "advisory workspace" : "group workspace"}
      </button>
    </Shell>
  );
}
