import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { ThemeWrap } from "@/components/ThemeWrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMT24 — Global Minimum Tax OS",
  description: "AI-powered Global Minimum Tax operating system for multinational groups. Source data → mapping → rules → calculation → explanation → GIR → audit.",
  applicationName: "GMT24",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  themeColor: "#0d0f14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <ThemeWrap>{children}</ThemeWrap>
        </StoreProvider>
      </body>
    </html>
  );
}
