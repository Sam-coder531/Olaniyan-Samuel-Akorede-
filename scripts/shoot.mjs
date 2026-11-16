import { chromium } from "playwright";
import fs from "node:fs/promises";

const URL = process.env.TARGET_URL || "http://127.0.0.1:3000";
const OUT = "shots";

const STOPS = [0, 0.08, 0.16, 0.24, 0.34, 0.44, 0.52, 0.62, 0.7, 0.78, 0.88, 0.97];

const log = [];
const say = (...a) => {
  const s = a.join(" ");
  console.log(s);
  log.push(s);
};

const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE: " + m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

// WebGL sanity
const gl = await page.evaluate(() => {
  const c = document.querySelector(".canvasWrap canvas");
  if (!c) return { canvas: false };
  const ctx = c.getContext("webgl2") || c.getContext("webgl");
  return {
    canvas: true,
    w: c.width,
    h: c.height,
    ctx: !!ctx,
    renderer: ctx
      ? (() => {
          const d = ctx.getExtension("WEBGL_debug_renderer_info");
          return d ? ctx.getParameter(d.UNMASKED_RENDERER_WEBGL) : "n/a";
        })()
      : null,
  };
});
say("WEBGL " + JSON.stringify(gl));
say("TITLE " + (await page.title()));

await fs.mkdir(OUT, { recursive: true });

const total = await page.evaluate(() => document.body.scrollHeight - innerHeight);

for (const p of STOPS) {
  const y = Math.round(total * p);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  // let springs + camera damping settle
  await page.waitForTimeout(1400);
  const name = `p${String(Math.round(p * 100)).padStart(3, "0")}.png`;
  await page.screenshot({ path: `${OUT}/${name}` });

  // what's on screen right now
  const state = await page.evaluate(() => {
    const beats = [...document.querySelectorAll(".beat")].map((b) => {
      const cs = getComputedStyle(b);
      const o = parseFloat(cs.opacity);
      const r = b.getBoundingClientRect();
      const txt = (b.querySelector("h1")?.innerText || "").replace(/\n/g, " / ");
      return { txt, o: +o.toFixed(2), top: Math.round(r.top), h: Math.round(r.height) };
    });
    const vis = beats.filter((b) => b.o > 0.15);
    return {
      pct: document.querySelector(".pct")?.textContent,
      visible: vis.map((b) => `${b.txt} (op=${b.o})`),
    };
  });
  say(`${name} @${y}px  pct=${state.pct}  visible=[${state.visible.join(" | ")}]`);
}

// mobile pass
const m = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await m.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await m.waitForTimeout(2000);
const mTotal = await m.evaluate(() => document.body.scrollHeight - innerHeight);
for (const p of [0, 0.35, 0.7, 0.97]) {
  await m.evaluate((yy) => window.scrollTo(0, yy), Math.round(mTotal * p));
  await m.waitForTimeout(1200);
  await m.screenshot({ path: `${OUT}/mobile-p${String(Math.round(p * 100)).padStart(3, "0")}.png` });
}
say("mobile shots done");

say("ERRORS " + (errors.length ? JSON.stringify(errors.slice(0, 12), null, 1) : "none"));

await fs.writeFile(`${OUT}/report.txt`, log.join("\n") + "\n");
await browser.close();
