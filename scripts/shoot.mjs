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

const ARGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--no-sandbox",
  "--disable-dev-shm-usage",
];

async function launch() {
  const attempts = [
    ["bundled", () => chromium.launch({ args: ARGS })],
    ["channel:chrome", () => chromium.launch({ channel: "chrome", args: ARGS })],
    [
      "system binary",
      () =>
        chromium.launch({
          executablePath: "/usr/bin/google-chrome",
          args: ARGS,
        }),
    ],
  ];
  for (const [label, fn] of attempts) {
    try {
      const b = await fn();
      say("LAUNCH ok via " + label);
      return b;
    } catch (e) {
      say("LAUNCH failed via " + label + ": " + String(e).split("\n")[0]);
    }
  }
  throw new Error("no chromium available");
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE: " + m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);

const gl = await page.evaluate(() => {
  const c = document.querySelector(".canvasWrap canvas");
  if (!c) return { canvas: false, html: document.querySelector(".canvasWrap")?.className };
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

// build stamp so it's obvious which code produced these frames
const stamp = await page.evaluate(async () => {
  const r = await fetch("/api/stamp").then((x) => x.json()).catch(() => null);
  return r;
});
say("BUILD " + JSON.stringify(stamp));
say("TITLE " + (await page.title()));

await fs.mkdir(OUT, { recursive: true });

const total = await page.evaluate(() => document.body.scrollHeight - innerHeight);
say("SCROLL HEIGHT " + total);

for (const p of STOPS) {
  const y = Math.round(total * p);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(1600);
  const name = `p${String(Math.round(p * 100)).padStart(3, "0")}.png`;
  await page.screenshot({ path: `${OUT}/${name}` });

  const state = await page.evaluate(() => {
    const beats = [...document.querySelectorAll(".beat")].map((b) => {
      const o = parseFloat(getComputedStyle(b).opacity);
      const txt = (b.querySelector("h1")?.innerText || "").replace(/\n/g, " / ");
      return { txt, o: +o.toFixed(2) };
    });
    return {
      pct: document.querySelector(".pct")?.textContent,
      visible: beats.filter((b) => b.o > 0.15).map((b) => `${b.txt} (${b.o})`),
    };
  });
  say(`${name} pct=${state.pct} visible=[${state.visible.join(" | ")}]`);
}

/* mobile */
const m = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await m.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await m.waitForTimeout(2500);
const mTotal = await m.evaluate(() => document.body.scrollHeight - innerHeight);
for (const p of [0, 0.35, 0.7, 0.97]) {
  await m.evaluate((yy) => window.scrollTo(0, yy), Math.round(mTotal * p));
  await m.waitForTimeout(1400);
  await m.screenshot({
    path: `${OUT}/mobile-p${String(Math.round(p * 100)).padStart(3, "0")}.png`,
  });
}
say("MOBILE shots done");

say("ERRORS " + (errors.length ? JSON.stringify(errors.slice(0, 10), null, 1) : "none"));

await fs.writeFile(`${OUT}/report.txt`, log.join("\n") + "\n");
await browser.close();
