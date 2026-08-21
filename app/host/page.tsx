"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { ProductMode } from "@/lib/model";
import {
  DEFAULT_DAYS,
  MAX_DAYS,
  MIN_DAYS,
  clampInviteDays,
  formatExpiry,
  isHostSession,
  mintInvite,
  pinMatches,
  readIssued,
  readLastMintUrl,
  setHostSession,
} from "@/lib/invite";

export default function HostPage() {
  const { login, flash } = useStore();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [mode, setMode] = useState<ProductMode>("inhouse");
  const [pin, setPin] = useState("7L-host");
  const [err, setErr] = useState("");
  const [lastUrl, setLastUrl] = useState("");
  const [host, setHost] = useState(false);
  const [issued, setIssued] = useState<ReturnType<typeof readIssued>>([]);
  const [busy, setBusy] = useState(false);
  const windowDays = clampInviteDays(days);

  useEffect(() => {
    setLastUrl(readLastMintUrl());
    setHost(isHostSession());
    setIssued(readIssued());
  }, []);

  const expiresPreview = useMemo(
    () => formatExpiry(Date.now() + windowDays * 24 * 60 * 60 * 1000),
    [windowDays],
  );

  function mint() {
    setBusy(true);
    setErr("");
    try {
      const minted = mintInvite({ days: windowDays, label, mode });
      setLastUrl(minted.url);
      setIssued(readIssued());
      flash(`Link live until ${formatExpiry(minted.payload.exp)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate the link. Hard-refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onMint(e: FormEvent) {
    e.preventDefault();
    mint();
  }

  function onUnlock(e: FormEvent) {
    e.preventDefault();
    if (!pinMatches(pin)) {
      setErr("Host key not recognised. Use 7L-host, or advisor / partner.");
      return;
    }
    setHostSession(true);
    setHost(true);
    setErr("");
    flash("Host unlocked");
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(lastUrl);
      flash("Review link copied");
    } catch {
      flash("Copy failed — select the URL");
    }
  }

  return (
    <div className="login-split">
      <section className="login-pane login-hero">
        <header className="login-pane-head">
          <div>
            <div className="login-mark">GMT24<span /></div>
            <span className="login-kicker">Host desk</span>
          </div>
        </header>
        <div className="login-pane-body">
          <h1 className="login-headline">{windowDays}-day GMT24 demo links</h1>
          <p className="login-lede">
            Each Generate creates a new URL. Send that URL only. After {windowDays} day{windowDays === 1 ? "" : "s"} the same link shows Access ended and will not open GMT24. Customers do not use this page.
          </p>
        </div>
        <footer className="login-pane-foot">
          <div className="login-stats">
            <div>
              <strong>{windowDays}d</strong>
              <span>This link life</span>
            </div>
            <div>
              <strong>{issued.filter((r) => Date.now() < r.exp).length}</strong>
              <span>Live on this browser</span>
            </div>
            <div>
              <strong>{MIN_DAYS}–{MAX_DAYS}</strong>
              <span>Adjustable days</span>
            </div>
          </div>
        </footer>
      </section>

      <section className="login-pane login-auth">
        <header className="login-pane-head">
          <div className="login-kicker-ghost">Host desk</div>
          <Link href="/" className="btn btn-ghost" style={{ fontSize: 12 }}>Public login</Link>
        </header>
        <div className="login-pane-body">
          <form className="login-card" onSubmit={onMint}>
            <p className="eyebrow" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Send one link per prospect</p>
            <h2>Generate a demo URL</h2>
            <p className="text-muted login-card-note">
              The expiry is signed into the URL, so a recipient on another device can open the Aetherion Group demo until that clock runs out. Default is {DEFAULT_DAYS} days.
            </p>
            <div className="field">
              <label htmlFor="hostLabel">Prospect / label (optional)</label>
              <input className="input" id="hostLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Firm name" />
            </div>
            <div className="field">
              <label htmlFor="hostDays">Days until the link closes</label>
              <input
                className="input"
                id="hostDays"
                name="days"
                type="number"
                min={MIN_DAYS}
                max={MAX_DAYS}
                value={days}
                onChange={(e) => setDays(clampInviteDays(e.target.value))}
              />
              <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {MIN_DAYS}–{MAX_DAYS} days. Default {DEFAULT_DAYS}. Closes about {expiresPreview}.
              </div>
            </div>
            <div className="field">
              <label htmlFor="hostMode">Demo door</label>
              <select className="input" id="hostMode" value={mode} onChange={(e) => setMode(e.target.value as ProductMode)}>
                <option value="inhouse">In-house (Aetherion)</option>
                <option value="advisor">Advisor firm</option>
              </select>
            </div>
            <p style={{ color: "var(--color-signal)", minHeight: "1.2em", margin: 0, fontSize: 13 }}>{err}</p>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? "Generating…" : `Generate ${windowDays}-day link`}
            </button>
          </form>

          {lastUrl ? (
            <div className="callout" style={{ marginTop: 16 }}>
              <div className="stat-label">Copy this to the customer</div>
              <textarea className="input" readOnly rows={4} value={lastUrl} style={{ marginTop: 8, fontSize: 12 }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button type="button" className="btn btn-primary" onClick={copyUrl}>Copy link</button>
                <a className="btn btn-secondary" href={lastUrl} target="_blank" rel="noreferrer">Open as guest</a>
              </div>
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: 13, marginTop: 12 }}>The customer URL appears here after Generate. It is not emailed automatically.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {host ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setHostSession(true);
                    login("advisor");
                    router.push("/clients");
                  }}
                >
                  Open Advisor (this browser)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setHostSession(false);
                    setHost(false);
                  }}
                >
                  Lock host
                </button>
              </>
            ) : (
              <form onSubmit={onUnlock}>
                <div className="field">
                  <label htmlFor="hostPin">Host key — only to open Advisor here (not needed to mint)</label>
                  <input className="input" id="hostPin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" />
                </div>
                <button className="btn btn-secondary btn-block" type="submit">Unlock Advisor on this browser</button>
              </form>
            )}
          </div>

          <p className="text-muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.55 }}>
            To cut off every live review link at once, bump INVITE_EPOCH in the invite engine and redeploy (CPR). Individual links die on their own expiry.
          </p>

          {issued.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="stat-label">Links minted on this browser</div>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Life</th>
                      <th>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {issued.map((row) => {
                      const live = Date.now() < Number(row.exp);
                      return (
                        <tr key={row.id}>
                          <td style={{ fontSize: 13 }}>{row.label || row.id}</td>
                          <td style={{ fontSize: 12 }}>{row.days || DEFAULT_DAYS}d · {row.mode}</td>
                          <td style={{ fontSize: 12 }}>{formatExpiry(row.exp)}</td>
                          <td><span className={live ? "tag tag-accent" : "tag tag-outline"}>{live ? "Live" : "Expired"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
