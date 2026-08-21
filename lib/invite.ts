import type { ProductMode } from "./model";

/** Time-limited demo invites. Default window is 3 days; expired tokens cannot open GMT24.
 *  Rotate INVITE_EPOCH (and redeploy) to cut off every outstanding link at once.
 *  HOST_PIN is for 7L only — never put it on the public login page.
 */
export const DEFAULT_DAYS = 3;
export const MIN_DAYS = 1;
export const MAX_DAYS = 14;
export const INVITE_EPOCH = 1;
export const HOST_PIN = "7L-host";

const SECRET = "gmt24-invite-v1-7L-advisory";
const INVITE_SESSION_KEY = "gmt24-invite-session";
const INVITE_AUTH_KEY = "gmt24_invite_auth";
const HOST_SESSION_KEY = "gmt24-host-session";
const ISSUED_KEY = "gmt24-invites-issued";
const LAST_URL_KEY = "gmt24-invite-last-url";

export type InvitePayload = {
  v: 1;
  epoch: number;
  id: string;
  mode: ProductMode;
  label: string;
  iat: number;
  exp: number;
  days: number;
};

export type IssuedInvite = {
  id: string;
  label: string;
  exp: number;
  iat: number;
  url: string;
  mode: ProductMode;
  days: number;
};

export type InviteSession = {
  id: string;
  mode: ProductMode;
  exp: number;
  epoch: number;
  label: string;
  token: string;
  days: number;
};

export function clampInviteDays(n: unknown): number {
  const v = typeof n === "number" ? n : typeof n === "string" && n.trim() !== "" ? Number(n) : NaN;
  if (!Number.isFinite(v)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(v)));
}

function b64urlEncodeBytes(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlEncodeStr(str: string) {
  return b64urlEncodeBytes(new TextEncoder().encode(str));
}

function b64urlDecodeStr(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function keyedSign(message: string) {
  const s = `${SECRET}|${message}`;
  const bytes = new Uint8Array(32);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
    const j = i % 32;
    bytes[j] ^= h & 255;
    bytes[(j + 7) % 32] ^= (h >>> 8) & 255;
    bytes[(j + 13) % 32] ^= (h >>> 16) & 255;
    bytes[(j + 19) % 32] ^= (h >>> 24) & 255;
  }
  for (let r = 0; r < 32; r++) {
    bytes[r] ^= bytes[(r + 3) % 32] ^ ((r * 31 + s.length) & 255);
  }
  return b64urlEncodeBytes(bytes);
}

function uid() {
  return `inv_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function reviewPath(token: string) {
  return `/review/${encodeURIComponent(token)}`;
}

export function reviewUrl(token: string) {
  const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://gmt24.vercel.app";
  return `${origin}${reviewPath(token)}`;
}

export function mintInvite({
  days = DEFAULT_DAYS,
  mode = "inhouse",
  label = "",
}: {
  days?: number;
  mode?: ProductMode;
  label?: string;
} = {}) {
  const now = Date.now();
  const windowDays = clampInviteDays(days);
  const payload: InvitePayload = {
    v: 1,
    epoch: INVITE_EPOCH,
    id: uid(),
    mode: mode === "advisor" ? "advisor" : "inhouse",
    label: String(label || "").slice(0, 80),
    iat: now,
    exp: now + windowDays * 24 * 60 * 60 * 1000,
    days: windowDays,
  };
  const body = b64urlEncodeStr(JSON.stringify(payload));
  const token = `${body}.${keyedSign(body)}`;
  const url = reviewUrl(token);
  rememberIssued({ ...payload, token, url });
  saveLastMintUrl(url);
  return { token, url, payload };
}

export async function verifyInvite(token: string): Promise<
  { ok: true; payload: InvitePayload; token: string } | { ok: false; reason: "invalid" | "expired" | "revoked"; payload?: InvitePayload }
> {
  const raw = decodeURIComponent(String(token || "").trim());
  if (!raw || !raw.includes(".")) return { ok: false, reason: "invalid" };
  const cut = raw.lastIndexOf(".");
  const body = raw.slice(0, cut);
  const sig = raw.slice(cut + 1);
  if (!body || !sig) return { ok: false, reason: "invalid" };
  let payload: InvitePayload;
  try {
    payload = JSON.parse(b64urlDecodeStr(body)) as InvitePayload;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (keyedSign(body) !== sig) return { ok: false, reason: "invalid" };
  if (Number(payload.epoch) !== INVITE_EPOCH) return { ok: false, reason: "revoked", payload };
  if (Date.now() >= Number(payload.exp)) return { ok: false, reason: "expired", payload };
  return { ok: true, payload, token: raw };
}

export function formatExpiry(exp: number) {
  try {
    return new Date(exp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

export function hoursLeft(exp: number) {
  const ms = Number(exp) - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (60 * 60 * 1000));
}

export function saveInviteSession(payload: InvitePayload, token: string) {
  localStorage.setItem(
    INVITE_SESSION_KEY,
    JSON.stringify({
      id: payload.id,
      mode: payload.mode === "advisor" ? "advisor" : "inhouse",
      exp: payload.exp,
      epoch: payload.epoch,
      label: payload.label || "",
      token,
      days: payload.days || DEFAULT_DAYS,
    } satisfies InviteSession),
  );
  localStorage.setItem(INVITE_AUTH_KEY, "1");
}

export function clearInviteSession() {
  try {
    localStorage.removeItem(INVITE_SESSION_KEY);
    localStorage.removeItem(INVITE_AUTH_KEY);
  } catch {
    /* private mode */
  }
}

export function isInviteAuth() {
  try {
    return localStorage.getItem(INVITE_AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function readInviteSession(): InviteSession | null {
  try {
    const raw = localStorage.getItem(INVITE_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as InviteSession;
    if (!s?.exp) return null;
    if (Number(s.epoch) !== INVITE_EPOCH) {
      localStorage.removeItem(INVITE_SESSION_KEY);
      return null;
    }
    if (Date.now() >= Number(s.exp)) {
      localStorage.removeItem(INVITE_SESSION_KEY);
      localStorage.removeItem(INVITE_AUTH_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setHostSession(on: boolean) {
  try {
    if (on) sessionStorage.setItem(HOST_SESSION_KEY, "1");
    else sessionStorage.removeItem(HOST_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function isHostSession() {
  try {
    return sessionStorage.getItem(HOST_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function pinMatches(pin: unknown) {
  const compact = String(pin || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");
  return compact === "7lhost" || compact === "advisor" || compact === "partner";
}

export function saveLastMintUrl(url: string) {
  try {
    if (url) sessionStorage.setItem(LAST_URL_KEY, url);
    else sessionStorage.removeItem(LAST_URL_KEY);
  } catch {
    /* private mode */
  }
}

export function readLastMintUrl() {
  try {
    return sessionStorage.getItem(LAST_URL_KEY) || "";
  } catch {
    return "";
  }
}

function rememberIssued(row: InvitePayload & { token: string; url: string }) {
  try {
    const list = readIssued();
    list.unshift({
      id: row.id,
      label: row.label,
      exp: row.exp,
      iat: row.iat,
      url: row.url,
      mode: row.mode,
      days: row.days,
    });
    localStorage.setItem(ISSUED_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* private mode */
  }
}

export function readIssued(): IssuedInvite[] {
  try {
    const list = JSON.parse(localStorage.getItem(ISSUED_KEY) || "[]") as IssuedInvite[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
