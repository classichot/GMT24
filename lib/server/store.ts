import "server-only";

/**
 * Server-side persistence adapter for work records (conversations, tickets,
 * facts, model-call log). The browser keeps a working copy for instant
 * navigation; this store is the durable record when configured.
 *
 *   GMT24_STORE = memory (default) | file | kv
 *   GMT24_STORE_PATH   directory for the file adapter (default .gmt24-store; not usable on read-only hosts)
 *   KV_REST_API_URL / KV_REST_API_TOKEN   Upstash / Vercel KV REST endpoint for the kv adapter
 *
 * Keys are always namespaced by tenant (group id) by the caller; the adapter
 * never merges across namespaces.
 */

export type StoreRecord = Record<string, unknown>;

export interface ServerStore {
  kind: "memory" | "file" | "kv";
  get<T = StoreRecord>(key: string): Promise<T | null>;
  set<T = StoreRecord>(key: string, value: T): Promise<void>;
  append<T = StoreRecord>(list: string, value: T, max?: number): Promise<void>;
  list<T = StoreRecord>(list: string, limit?: number): Promise<T[]>;
}

class MemoryStore implements ServerStore {
  kind = "memory" as const;
  private kv = new Map<string, unknown>();
  private lists = new Map<string, unknown[]>();
  async get<T>(key: string) { return (this.kv.get(key) as T) ?? null; }
  async set<T>(key: string, value: T) { this.kv.set(key, value); }
  async append<T>(list: string, value: T, max = 2000) { const arr = this.lists.get(list) ?? []; arr.unshift(value); if (arr.length > max) arr.length = max; this.lists.set(list, arr); }
  async list<T>(list: string, limit = 100) { return ((this.lists.get(list) ?? []) as T[]).slice(0, limit); }
}

class FileStore implements ServerStore {
  kind = "file" as const;
  constructor(private dir: string) {}
  private async fs() { return import("node:fs/promises"); }
  private path(name: string) { return `${this.dir}/${name.replace(/[^a-z0-9:_-]/gi, "_")}.json`; }
  private async read<T>(name: string): Promise<T | null> { try { const fs = await this.fs(); return JSON.parse(await fs.readFile(this.path(name), "utf8")) as T; } catch { return null; } }
  private async write(name: string, v: unknown) { const fs = await this.fs(); await fs.mkdir(this.dir, { recursive: true }); await fs.writeFile(this.path(name), JSON.stringify(v)); }
  async get<T>(key: string) { return this.read<T>(`kv_${key}`); }
  async set<T>(key: string, value: T) { await this.write(`kv_${key}`, value); }
  async append<T>(list: string, value: T, max = 2000) { const arr = (await this.read<T[]>(`list_${list}`)) ?? []; arr.unshift(value); if (arr.length > max) arr.length = max; await this.write(`list_${list}`, arr); }
  async list<T>(list: string, limit = 100) { return ((await this.read<T[]>(`list_${list}`)) ?? []).slice(0, limit); }
}

class KvRestStore implements ServerStore {
  kind = "kv" as const;
  constructor(private url: string, private token: string) {}
  private async cmd<T>(...parts: (string | number)[]): Promise<T | null> {
    const res = await fetch(`${this.url}/${parts.map((p) => encodeURIComponent(String(p))).join("/")}`, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`kv ${res.status}`);
    const data = (await res.json()) as { result: T };
    return data.result ?? null;
  }
  async get<T>(key: string) { const raw = await this.cmd<string>("get", key); return raw ? (JSON.parse(raw) as T) : null; }
  async set<T>(key: string, value: T) { await this.cmd("set", key, JSON.stringify(value)); }
  async append<T>(list: string, value: T, max = 2000) { await this.cmd("lpush", list, JSON.stringify(value)); await this.cmd("ltrim", list, 0, max - 1); }
  async list<T>(list: string, limit = 100) { const raw = (await this.cmd<string[]>("lrange", list, 0, limit - 1)) ?? []; return raw.map((s) => JSON.parse(s) as T); }
}

function build(): ServerStore {
  const kind = process.env.GMT24_STORE ?? (process.env.KV_REST_API_URL ? "kv" : "memory");
  if (kind === "kv" && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return new KvRestStore(process.env.KV_REST_API_URL.replace(/\/$/, ""), process.env.KV_REST_API_TOKEN);
  if (kind === "file") return new FileStore(process.env.GMT24_STORE_PATH ?? ".gmt24-store");
  return new MemoryStore();
}

const g = globalThis as unknown as { __gmt24Store?: ServerStore };
export const serverStore: ServerStore = g.__gmt24Store ?? (g.__gmt24Store = build());
