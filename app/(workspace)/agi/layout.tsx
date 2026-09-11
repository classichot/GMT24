"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";
import { AgiToggle } from "@/components/AgiToggle";
import { AgiFrame } from "@/components/agi/AgiFrame";
import { AgiProvider } from "@/lib/agi/useAgi";
import { useStore } from "@/lib/store";

/**
 * The AGI workspace only exists while AGI mode is on. With the toggle off,
 * every /agi route shows this gate and the rest of GMT24 behaves exactly as
 * before — no mission state is read, no gateway call is made.
 */
export default function AgiLayout({ children }: { children: ReactNode }) {
  const { agiMode } = useStore();
  if (!agiMode) {
    return (
      <div className="agi-off">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Bot size={22} />
          <span className="tag tag-neutral">AGI mode is off</span>
        </div>
        <h2>AGI mode is a separate layer</h2>
        <p>
          AGI mode adds a mission-execution layer above the normal platform: agents (the built-in workspace, Grok Bot, Claude Cowork or GPT Work) plan and run a Pillar Two mission — compare eligible elections, verify the calculation, review compliance and prepare the audit package — while GMT24 keeps the engines, rule versions, permissions and evidence records. Turning it on adds the AGI Mode menu and these six screens. Turning it off hides them; normal mode never changes either way, and mission records are kept.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          <AgiToggle goto={false} />
          <Link href="/overview" className="btn btn-secondary">Back to normal mode</Link>
        </div>
      </div>
    );
  }
  return (
    <AgiProvider>
      <AgiFrame>{children}</AgiFrame>
    </AgiProvider>
  );
}
