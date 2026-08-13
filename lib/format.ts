export function eur(n: number, compact = false) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (compact) {
    if (abs >= 1_000_000_000) return `${sign}€${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}k`;
  }
  return `${sign}€${abs.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function pct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function money(n: number) {
  return Math.round(n);
}

export type ThemeKey = "light" | "dark" | "bw";

export const THEMES = {
  light: {
    name: "Light",
    scheme: "light",
    vars: {
      "--color-bg": "#f3f2f2",
      "--color-surface": "#eae9e9",
      "--color-text": "#201e1d",
      "--color-divider": "color-mix(in srgb, #201e1d 24%, transparent)",
      "--color-accent": "#3a4fa8",
      "--color-accent-100": "#eef0fc",
      "--color-accent-200": "#dce1f9",
      "--color-accent-300": "#bfc7f2",
      "--color-accent-400": "#7e93f4",
      "--color-accent-500": "#5c78f0",
      "--color-accent-600": "#3a4fa8",
      "--color-accent-700": "#243266",
      "--color-accent-800": "#1a2447",
      "--color-accent-900": "#131a33",
      "--sig-red": "#b42318",
      "--sig-amber": "#b54708",
      "--color-neutral-100": "#f4f5f4",
      "--color-neutral-200": "#e6e9e7",
      "--color-neutral-300": "#d3d8d5",
      "--color-neutral-400": "#b1b8b4",
      "--color-neutral-500": "#8e9692",
      "--color-neutral-600": "#6c746f",
      "--color-neutral-700": "#545c58",
      "--color-neutral-800": "#383f3c",
      "--color-neutral-900": "#222826",
      "--shadow-md": "0 3px 10px color-mix(in srgb, #222826 16%, transparent)",
      "--shadow-lg": "0 12px 32px color-mix(in srgb, #222826 22%, transparent)",
    },
  },
  dark: {
    name: "Dark",
    scheme: "dark",
    vars: {
      "--color-bg": "#0d0f14",
      "--color-surface": "#171a21",
      "--color-text": "#eef0f4",
      "--color-divider": "color-mix(in srgb, #eef0f4 22%, transparent)",
      "--color-accent": "#5c78f0",
      "--color-accent-100": "#131a33",
      "--color-accent-200": "#1a2447",
      "--color-accent-300": "#243266",
      "--color-accent-400": "#3a4fa8",
      "--color-accent-500": "#5c78f0",
      "--color-accent-600": "#7e93f4",
      "--color-accent-700": "#a2b1f8",
      "--color-accent-800": "#c4cefb",
      "--color-accent-900": "#e2e7fd",
      "--color-neutral-100": "#171a21",
      "--color-neutral-200": "#1e222b",
      "--color-neutral-300": "#2a2f3a",
      "--color-neutral-400": "#3b414e",
      "--color-neutral-500": "#5a6170",
      "--color-neutral-600": "#8d93a1",
      "--color-neutral-700": "#b3b8c4",
      "--color-neutral-800": "#d3d7df",
      "--color-neutral-900": "#eaecf1",
      "--sig-red": "#e2725b",
      "--sig-amber": "#d9a441",
      "--shadow-md": "0 0 0 1px color-mix(in srgb, #e8eeec 12%, transparent), 0 8px 20px rgba(0,0,0,0.45)",
      "--shadow-lg": "0 0 0 1px color-mix(in srgb, #e8eeec 16%, transparent), 0 18px 40px rgba(0,0,0,0.55)",
    },
  },
  bw: {
    name: "B&W",
    scheme: "light",
    vars: {
      "--color-bg": "#ffffff",
      "--color-surface": "#f3f3f3",
      "--color-text": "#111111",
      "--color-divider": "color-mix(in srgb, #111111 22%, transparent)",
      "--color-accent": "#111111",
      "--color-accent-100": "#f2f2f2",
      "--color-accent-200": "#e4e4e4",
      "--color-accent-300": "#c8c8c8",
      "--color-accent-400": "#9a9a9a",
      "--color-accent-500": "#6a6a6a",
      "--color-accent-600": "#2c2c2c",
      "--color-accent-700": "#1a1a1a",
      "--color-accent-800": "#111111",
      "--color-accent-900": "#000000",
      "--color-neutral-100": "#f7f7f7",
      "--color-neutral-200": "#ececec",
      "--color-neutral-300": "#d6d6d6",
      "--color-neutral-400": "#b3b3b3",
      "--color-neutral-500": "#8f8f8f",
      "--color-neutral-600": "#6e6e6e",
      "--color-neutral-700": "#525252",
      "--color-neutral-800": "#333333",
      "--color-neutral-900": "#111111",
      "--shadow-md": "0 3px 10px color-mix(in srgb, #111111 14%, transparent)",
      "--shadow-lg": "0 12px 32px color-mix(in srgb, #111111 20%, transparent)",
    },
  },
} as const;

export function normalizeTheme(raw: string | null): ThemeKey {
  if (raw === "dark" || raw === "bw" || raw === "light") return raw;
  return "dark";
}
