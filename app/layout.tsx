import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ChatGPT-inspired assistant", description: "A simple space to think, create, and explore." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
