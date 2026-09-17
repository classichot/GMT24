"use client";

import { Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * AGI mode switch. On: the mission-execution layer (AGI workspace, agent
 * gateway controls) appears as its own section above normal mode. Off: it is
 * hidden and normal mode runs exactly as before. Mission records are kept.
 */
export function AgiToggle({ compact = false, goto = true }: { compact?: boolean; goto?: boolean }) {
  const { agiMode, setAgiMode, flash } = useStore();
  const router = useRouter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={agiMode}
      className={`agi-switch${agiMode ? " on" : ""}${compact ? " compact" : ""}`}
      title={agiMode ? "AGI mode is on — click to turn off" : "Turn AGI mode on"}
      onClick={() => {
        const next = !agiMode;
        setAgiMode(next);
        flash(next ? "AGI mode on — mission layer available" : "AGI mode off — normal mode only");
        if (next && goto) router.push("/agi");
        if (!next && goto && typeof window !== "undefined" && window.location.pathname.startsWith("/agi")) router.push("/overview");
      }}
    >
      <span className="agi-switch-icon" aria-hidden>
        <Bot size={compact ? 15 : 16} />
        <span className="agi-switch-caption">AGI</span>
      </span>
      <span className="agi-switch-label">AGI mode</span>
      <span className="agi-switch-track" aria-hidden><span className="agi-switch-knob" /></span>
      <span className="agi-switch-state">{agiMode ? "On" : "Off"}</span>
    </button>
  );
}
