import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "AKOREDE FM — Afrobeats & Polyrhythm Groovebox",
  description:
    "Tactile Web Audio Afrobeats, Amapiano & West African polyrhythm synthesizer, step sequencer, WAV loop exporter, and live community beat crate. Crafted for Olaniyan Samuel Akorede (@Sam-coder531) in Lagos.",
  openGraph: {
    title: "AKOREDE FM — Afrobeats & Polyrhythm Groovebox",
    description:
      "Compose interlocking Afrobeats, Amapiano log-drum & Yoruba talking-drum grooves right in your browser. Export studio WAV loops or press beats to the live global crate.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AKOREDE FM — Polyrhythm Hardware Groovebox",
    description:
      "8-channel Web Audio Afrobeats & Amapiano synth, Euclidean polyrhythms, live OLED scope, WAV bounce & global community crate.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="studio-desk min-h-screen text-[#181715] selection:bg-[#FF4F1F] selection:text-white">
        {children}
      </body>
    </html>
  );
}
