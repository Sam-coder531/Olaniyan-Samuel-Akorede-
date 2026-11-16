import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://airpods-pro-film.vercel.app"),
  title: "AirPods Pro — Silence, engineered.",
  description:
    "An interactive product film. Scroll to take AirPods apart, silence the world, and put it back together again.",
  openGraph: {
    title: "AirPods Pro — Silence, engineered.",
    description:
      "Scroll to take AirPods apart, silence the world, and put it back together again.",
    images: ["/assets/airpods/hero-case-open.webp"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AirPods Pro — Silence, engineered.",
    images: ["/assets/airpods/hero-case-open.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
