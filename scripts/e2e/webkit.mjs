// Safari-engine smoke test: iPhone emulation in Playwright WebKit.
// Playwright is not a project dependency. To run it once:
//   npx -y playwright@1 install webkit   (then run from a folder with playwright installed)
//   BASE=https://rocketgame.app node scripts/e2e/webkit.mjs
import { webkit, devices } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3123";
const GAMES = [
  "rocket-run",
  "comet-kick",
  "star-slugger",
  "snake",
  "minesweeper",
  "tictactoe",
  "memory",
  "2048",
];
const browser = await webkit.launch();
let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? "ok" : "FAIL"} - ${m}`);
  if (!c) failed++;
};
for (const [name, device] of [
  ["iPhone portrait", devices["iPhone 13"]],
  ["iPhone landscape", devices["iPhone 13 landscape"]],
]) {
  const context = await browser.newContext({ ...device });
  // iPhone Safari has no element fullscreen.
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = undefined;
    Element.prototype.webkitRequestFullscreen = undefined;
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  console.log(
    `\n## ${name} (${device.viewport.width}x${device.viewport.height})`,
  );
  await page.goto(BASE + "/");
  ok(
    (await page.evaluate(() => document.documentElement.scrollWidth)) <=
      device.viewport.width,
    "home: no horizontal scroll",
  );
  for (const slug of GAMES) {
    await page.goto(`${BASE}/games/${slug}`);
    await page.locator("[role=dialog] button.btn-primary").tap();
    await page.waitForTimeout(700);
    const playing =
      (await page.locator("[role=dialog] h2").count()) === 0 ||
      (await page.locator("[role=dialog] h2").textContent()) ===
        "Turn your phone sideways!";
    ok(playing, `${slug}: starts`);
    if (["rocket-run", "comet-kick", "star-slugger", "snake"].includes(slug)) {
      await page.waitForSelector("canvas", { timeout: 8000 }).catch(() => {});
      ok(
        (await page.locator("canvas").count()) === 1,
        `${slug}: Phaser canvas renders`,
      );
    }
    await page.locator("[data-fullscreen-button]").tap();
    await page.waitForTimeout(400);
    const mode = await page
      .locator("[data-game-stage]")
      .getAttribute("data-fullscreen");
    const box = await page.evaluate(() => {
      const r = document.querySelector(".game-board").getBoundingClientRect();
      return {
        l: r.left,
        t: r.top,
        r: r.right,
        b: r.bottom,
        vw: innerWidth,
        vh: innerHeight,
      };
    });
    ok(
      mode === "pseudo" &&
        box.l >= -1 &&
        box.t >= -1 &&
        box.r <= box.vw + 1 &&
        box.b <= box.vh + 1,
      `${slug}: full-screen fallback, board fits (${mode})`,
    );
    if (name.includes("landscape")) {
      const controls = await page.locator("[data-touch-controls]").count();
      const expected = [
        "rocket-run",
        "comet-kick",
        "star-slugger",
        "snake",
        "minesweeper",
        "2048",
      ].includes(slug)
        ? 1
        : 0;
      ok(
        controls === expected,
        `${slug}: touch controls ${expected ? "shown" : "not needed"}`,
      );
    }
    if (slug === "rocket-run" && !name.includes("landscape")) {
      ok(
        await page.getByText("Turn your phone sideways!").isVisible(),
        "rocket-run: asks to turn sideways",
      );
    }
    await page.screenshot({
      path: `${import.meta.dirname}/out/wk-${slug}-${name.includes("landscape") ? "land" : "port"}.png`,
    });
    await page.goBack();
    await page.waitForTimeout(400);
    ok(
      (await page
        .locator("[data-game-stage]")
        .getAttribute("data-fullscreen")) === "off" &&
        new URL(page.url()).pathname === `/games/${slug}`,
      `${slug}: Back exits full screen, stays on page`,
    );
  }
  ok(errors.length === 0, `no page errors ${errors.join(" | ")}`);
  await context.close();
}
await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
