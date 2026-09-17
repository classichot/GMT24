import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdf.js is loaded at runtime on the server (document processing); keep it out of the bundler.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
