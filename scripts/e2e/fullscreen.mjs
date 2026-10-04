// Fullscreen button, pseudo-fullscreen fallback, touch controls and fit, for every game.
const BASE = process.env.BASE ?? "http://localhost:3123";
const ONLY = process.env.GAMES?.split(",");

// What each game should show in fullscreen on a touch screen.
const GAMES = {
  "rocket-run": { pad: false, actions: ["boost"], landscape: true },
  snake: { pad: true, actions: [], landscape: false },
  2048: { pad: true, actions: [], landscape: false },
  minesweeper: { pad: false, actions: ["flag"], landscape: false },
  tictactoe: { pad: false, actions: [], landscape: false },
  memory: { pad: false, actions: [], landscape: false },
  "comet-kick": { pad: true, actions: ["kick"], landscape: true },
  "star-slugger": { pad: false, actions: ["swing"], landscape: true },
};

export default async function scenario(page) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const fsMode = () =>
    page.eval(`document.querySelector("[data-game-stage]").dataset.fullscreen`);
  const boardBox = () =>
    page.eval(`(() => { const r = document.querySelector(".game-board").getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; })()`);
  const fits = (b) =>
    b.l >= -1 && b.t >= -1 && b.r <= b.vw + 1 && b.b <= b.vh + 1;
  const start = async (touch = false) => {
    const sel = "[role=dialog] button.btn-primary";
    if (touch) await page.tap(sel);
    else await page.click(sel);
    await page.sleep(400);
  };
  const resumeIfPaused = async () => {
    if ((await overlay()) === "Paused")
      await page.click("[role=dialog] button.btn-primary");
  };

  // Count vibrations; let the iPhone run remove the Fullscreen API.
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `navigator.vibrate = () => { window.__vib = (window.__vib || 0) + 1; return true; };
      { const orig = Element.prototype.requestFullscreen;
        Element.prototype.requestFullscreen = function (...a) { return orig.apply(this, a).catch((e) => { window.__fsErr = String(e); throw e; }); }; }
      if (sessionStorage.getItem("noFullscreen")) {
        Element.prototype.requestFullscreen = undefined;
        Element.prototype.webkitRequestFullscreen = undefined;
        Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false });
      }`,
  });

  for (const [slug, spec] of Object.entries(GAMES)) {
    if (ONLY && !ONLY.includes(slug)) continue;
    console.log(`\n## ${slug}`);

    // Desktop: native fullscreen, Esc exits and pauses. No touch controls.
    await page.viewport(1280, 800);
    await page.goto(`${BASE}/games/${slug}`);
    await page.eval(`sessionStorage.clear()`);
    const btn = await page.center("[data-fullscreen-button]");
    assert(
      btn && btn.w >= 44 && btn.h >= 44,
      `fullscreen button is ${btn?.w}x${btn?.h}`,
    );
    let b = await boardBox();
    assert(
      fits(b),
      `desktop: whole board visible (${Math.round(b.w)}x${Math.round(b.h)})`,
    );
    await start();
    await page.click("[data-fullscreen-button]");
    await page.sleep(500);
    const native = await page.eval(
      `document.fullscreenElement === document.querySelector("[data-game-stage]")`,
    );
    assert(
      native && (await fsMode()) === "native",
      "button puts the game stage (not the page) in native fullscreen",
    );
    assert(
      (await page.eval(
        `document.querySelector("[data-fullscreen-button]").getAttribute("aria-label")`,
      )) === "Exit full screen",
      "icon/label switches to Exit full screen",
    );
    b = await boardBox();
    const ratio = b.w / b.h;
    assert(
      fits(b),
      `fullscreen board fits (${Math.round(b.w)}x${Math.round(b.h)} in ${b.vw}x${b.vh})`,
    );
    assert(
      !(await page.eval(`!!document.querySelector("[data-touch-controls]")`)),
      "no touch controls with a mouse",
    );
    await page.screenshot(`fs-${slug}-desktop`);
    await page.key("Escape");
    await page.sleep(500);
    assert(
      (await page.eval(`document.fullscreenElement`)) === null &&
        (await fsMode()) === "off",
      "Esc leaves fullscreen",
    );
    assert(
      (await page.eval(
        `document.querySelector("[data-fullscreen-button]").getAttribute("aria-label")`,
      )) === "Full screen",
      "icon/label switches back",
    );
    const after = await overlay();
    assert(
      after === "Paused" || after !== null,
      `leaving fullscreen pauses (${after})`,
    );

    // Phone sideways, touch: controls in fullscreen.
    await page.viewport(750, 342, { mobile: true, landscape: true });
    await page.goto(`${BASE}/games/${slug}`);
    assert(
      (await page.eval(`matchMedia("(pointer: coarse)").matches`)) === true,
      "touch emulation reports a coarse pointer",
    );
    const sw = await page.eval("document.documentElement.scrollWidth");
    assert(sw <= 750, `no horizontal scroll (${sw})`);
    await start(true);
    await page.tap("[data-fullscreen-button]");
    await page.sleep(600);
    if ((await fsMode()) === "pseudo") {
      // Headless Chrome sometimes refuses a quick second fullscreen request
      // ("not granted"); the game falls back to pseudo-fullscreen. Retry once.
      console.log(
        `  (native refused: ${await page.eval("window.__fsErr")}; got the fallback, retrying)`,
      );
      await page.eval("history.back()");
      await page.sleep(500);
      await resumeIfPaused();
      await page.tap("[data-fullscreen-button]");
      await page.sleep(600);
    }
    {
      const m = await fsMode();
      const c = await page.center("[data-fullscreen-button]");
      assert(
        m === "native",
        `tap enters fullscreen on the phone (${m}, button at ${JSON.stringify(c)}, err ${await page.eval("window.__fsErr ?? ''")}, ss ${await page.eval("sessionStorage.getItem('noFullscreen')")})`,
      );
    }
    b = await boardBox();
    assert(
      fits(b) && Math.abs(b.w / b.h - ratio) < 0.02,
      `board fits, aspect kept (${(b.w / b.h).toFixed(2)})`,
    );
    await resumeIfPaused();
    const hasControls = spec.pad || spec.actions.length > 0;
    assert(
      (await page.eval(`!!document.querySelector("[data-touch-controls]")`)) ===
        hasControls,
      hasControls ? "touch controls shown" : "no touch controls needed",
    );
    assert(
      (await page.eval(`!!document.querySelector("[data-touch-pad]")`)) ===
        spec.pad,
      `pad ${spec.pad ? "shown" : "hidden"}`,
    );
    for (const id of spec.actions) {
      assert(
        await page.eval(
          `!!document.querySelector('[data-touch-action="${id}"]')`,
        ),
        `"${id}" button shown`,
      );
      const c = await page.center(`[data-touch-action="${id}"]`);
      assert(c.w >= 64, `"${id}" button is big (${c.w}px)`);
    }
    if (hasControls) {
      await page.screenshot(`fs-${slug}-phone`);
      // Two fingers at once: pad + action, or two presses.
      const pts = [];
      if (spec.pad) {
        const p = await page.center("[data-touch-pad]");
        pts.push({ x: p.x + p.w * 0.35, y: p.y, id: 1 });
      }
      for (const id of spec.actions) {
        const c = await page.center(`[data-touch-action="${id}"]`);
        pts.push({ x: c.x, y: c.y, id: 2 });
      }
      const v0 = await page.eval("window.__vib || 0");
      await page.touch("touchStart", pts);
      await page.sleep(80);
      await page.touch("touchEnd", []);
      await page.sleep(150);
      const v1 = await page.eval("window.__vib || 0");
      assert(
        v1 - v0 === pts.length,
        `${pts.length} simultaneous touch(es) registered, each vibrates (${v1 - v0})`,
      );

      // Vibration off (in the Paused screen): no buzz.
      await resumeIfPaused();
      await page.tap('[aria-label="Pause"]');
      assert(
        await page.eval(
          `!!document.querySelector('[role=dialog] [aria-label="Vibration"]')`,
        ),
        "Paused screen has the vibration switch",
      );
      await page.tap('[role=dialog] [aria-label="Vibration"]');
      await page.tap("[role=dialog] button.btn-primary");
      await page.sleep(150);
      if ((await overlay()) === null) {
        const v2 = await page.eval("window.__vib || 0");
        await page.touch("touchStart", [pts[0]]);
        await page.touch("touchEnd", []);
        await page.sleep(100);
        assert(
          (await page.eval("window.__vib || 0")) === v2,
          "vibration switch turns buzzing off",
        );
      }
      await page.eval(
        `localStorage.setItem("rocketgame:settings", JSON.stringify({ ...JSON.parse(localStorage.getItem("rocketgame:settings")), vibration: true }))`,
      );
      // Corner buttons and action buttons don't overlap.
      const overlap = await page.eval(`(() => {
        const a = [...document.querySelectorAll(".hud-right button, [data-fullscreen-button]")].map(e => e.getBoundingClientRect());
        const b = [...document.querySelectorAll("[data-touch-action], [data-touch-pad]")].map(e => e.getBoundingClientRect());
        return a.some(r => b.some(q => r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom));
      })()`);
      assert(!overlap, "touch controls don't overlap the corner buttons");

      // Hide / show controls.
      await page.tap('[aria-label="On-screen controls"]');
      assert(
        !(await page.eval(`!!document.querySelector("[data-touch-controls]")`)),
        "controls toggle hides them",
      );
      await page.tap('[aria-label="On-screen controls"]');
      // (Snake may have hit a wall by now, which hides the controls with the game.)
      const shown = await page.eval(
        `!!document.querySelector("[data-touch-controls]")`,
      );
      const pressed = await page.eval(
        `document.querySelector('[aria-label="On-screen controls"]').getAttribute("aria-pressed")`,
      );
      assert(
        shown || ((await overlay()) !== null && pressed === "true"),
        "and shows them again",
      );
    }
    await page.tap("[data-fullscreen-button]");
    await page.sleep(400);
    assert((await fsMode()) === "off", "button exits fullscreen");

    // Portrait phone.
    await page.viewport(390, 844, { mobile: true, landscape: false });
    await page.goto(`${BASE}/games/${slug}`);
    b = await boardBox();
    assert(
      fits(b),
      `portrait page: whole board on screen without scrolling (bottom ${Math.round(b.b)} of ${b.vh})`,
    );
    assert(
      (await page.eval("document.documentElement.scrollWidth")) <= 390,
      "no horizontal scroll at 390px",
    );
    await page.screenshot(`page-${slug}-portrait`);
    if (spec.landscape) {
      assert(
        await page.eval(
          `document.body.textContent.includes("turn your phone sideways")`,
        ),
        "portrait tip shown",
      );
      await start(true);
      await page.tap("[data-fullscreen-button]");
      await page.sleep(500);
      assert(
        await page.eval(
          `document.body.textContent.includes("Turn your phone sideways!")`,
        ),
        "fullscreen portrait asks to turn the phone",
      );
      await page.screenshot(`fs-${slug}-rotate`);
      await page.tap("[data-fullscreen-button]");
      await page.sleep(300);
    }

    // iPhone: no Fullscreen API, so pseudo-fullscreen; Back gesture exits.
    await page.eval(`sessionStorage.setItem("noFullscreen", "1")`);
    await page.viewport(390, 844, { mobile: true, landscape: false });
    await page.goto(`${BASE}/games/${slug}`);
    await start(true);
    await page.tap("[data-fullscreen-button]");
    await page.sleep(400);
    assert(
      (await fsMode()) === "pseudo",
      "no Fullscreen API: falls back to pseudo-fullscreen",
    );
    const stage = await page.eval(
      `(() => { const r = document.querySelector("[data-game-stage]").getBoundingClientRect(); return [r.width, r.height]; })()`,
    );
    assert(
      stage[0] === 390 && stage[1] === 844,
      `stage covers the screen (${stage})`,
    );
    b = await boardBox();
    assert(fits(b), "board fits in pseudo-fullscreen");
    await page.eval("history.back()");
    await page.sleep(500);
    assert((await fsMode()) === "off", "Back gesture exits pseudo-fullscreen");
    assert(
      (await page.eval("location.pathname")) === `/games/${slug}`,
      "and stays on the game page",
    );
    await page.eval(`sessionStorage.clear()`);
  }

  if (page.errors.length) throw new Error("page had errors");
}
