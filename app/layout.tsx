import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "UNFINISHED ∞ — a painting no one will finish";
const description =
  "The machine started a painting it cannot finish. Every visitor adds permanent ink, live. Watch the whole thing replay from the first stroke.";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "UNFINISHED",
  keywords: ["generative art", "collaborative canvas", "realtime", "supabase", "next.js"],
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "UNFINISHED ∞",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "A painting no one will finish" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
