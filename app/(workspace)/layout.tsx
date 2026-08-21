"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { isInviteAuth, readInviteSession } from "@/lib/invite";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { ready, authed, logout } = useStore();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (isInviteAuth() && !readInviteSession()) {
      logout();
      router.replace("/review/ended");
      return;
    }
    if (!authed) router.replace("/");
  }, [ready, authed, logout, router, path]);

  if (!ready || !authed) {
    return <div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />;
  }

  return <AppShell>{children}</AppShell>;
}
