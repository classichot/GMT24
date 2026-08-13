"use client";

import { useEffect, type ReactNode } from "react";
import { THEMES } from "@/lib/format";
import { useStore } from "@/lib/store";

export function ThemeWrap({ children }: { children: ReactNode }) {
  const { theme, themeVars } = useStore();
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(themeVars).forEach(([key, value]) => root.style.setProperty(key, value));
    root.dataset.theme = theme;
    root.style.colorScheme = THEMES[theme].scheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeVars["--color-bg"] ?? "#ffffff");
  }, [theme, themeVars]);
  return <>{children}</>;
}
