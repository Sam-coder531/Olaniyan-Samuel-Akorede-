import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/**
 * Tiny build fingerprint so screenshot runs prove they rendered current code.
 */
export async function GET() {
  const files = [
    "components/three/Scene.tsx",
    "components/three/AirPod.tsx",
    "components/three/AirPodsCase.tsx",
  ];
  const parts: string[] = [];
  for (const f of files) {
    try {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      parts.push(f + ":" + createHash("sha1").update(src).digest("hex").slice(0, 8));
    } catch {
      parts.push(f + ":missing");
    }
  }
  return NextResponse.json({
    scene: parts.join(" "),
    at: new Date().toISOString(),
  });
}
