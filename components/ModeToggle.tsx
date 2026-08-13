"use client";

import { Contrast, Moon, Sun } from "lucide-react";
import { THEMES, type ThemeKey } from "@/lib/format";
import { useStore } from "@/lib/store";

const MODES: { key: ThemeKey; icon: typeof Sun }[] = [
  { key: "light", icon: Sun },
  { key: "dark", icon: Moon },
  { key: "bw", icon: Contrast },
];

export function ModeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useStore();
  return (
    <div className={`mode-toggle${compact ? " compact" : ""}`} role="radiogroup" aria-label="Appearance">
      {MODES.map(({ key, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={theme === key}
          aria-label={THEMES[key].name}
          title={THEMES[key].name}
          onClick={() => setTheme(key)}
        >
          <Icon size={compact ? 15 : 16} />
          <span className="mode-label">{THEMES[key].name}</span>
        </button>
      ))}
    </div>
  );
}
