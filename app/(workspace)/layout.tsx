"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { ready, authed } = useStore();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (ready && !authed) router.replace("/");
  }, [ready, authed, router, path]);

  if (!ready || !authed) {
    return <div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />;
  }

  return <AppShell>{children}</AppShell>;
}
