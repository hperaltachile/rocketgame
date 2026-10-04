// Minimal headless Edge/Chrome driver over the DevTools protocol (Node 22+ global WebSocket).
// Usage: node scripts/e2e/cdp.mjs scripts/e2e/<scenario>.mjs
//   A scenario default-exports async (page) => {}. BASE=<url> picks the site
//   (default http://localhost:3123), BROWSER=<path> overrides the browser.
// Screenshots go to scripts/e2e/out/ (git-ignored).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EDGE =
  process.env.BROWSER ??
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const OUT = resolve(import.meta.dirname, "out");
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "edge-cdp-"));
const edge = spawn(EDGE, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "about:blank",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (targets.some((t) => t.type === "page")) break;
  } catch {}
  await sleep(200);
}
const target = targets.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

let id = 0;
const pending = new Map();
const errors = [];
// Noise from browser extensions (e.g. a crypto wallet injecting window.ethereum).
const isExtension = (text) =>
  ["chrome-extension://", "provider is disconnected", "code=4900"].some((s) =>
    String(text ?? "").includes(s),
  );
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const ex = msg.params.exceptionDetails;
    const props = ex.exception?.preview?.properties
      ?.map((p) => `${p.name}=${p.value}`)
      .join(", ");
    const d = `${ex.text} | ${ex.exception?.description ?? ""} | ${props ?? ""} | ${ex.url ?? ex.stackTrace?.callFrames?.[0]?.url ?? ""}:${ex.lineNumber}`;
    if (!isExtension(d)) errors.push(d);
  } else if (
    msg.method === "Runtime.consoleAPICalled" &&
    msg.params.type === "error"
  ) {
    const where = msg.params.stackTrace?.callFrames?.[0]?.url ?? "";
    const text = msg.params.args
      .map(
        (a) =>
          a.value ??
          a.preview?.properties
            ?.map((p) => `${p.name}=${p.value}`)
            .join(", ") ??
          a.description,
      )
      .join(" ");
    if (!isExtension(where)) errors.push(`${text}  @ ${where}`);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Page.bringToFront");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });

const KEYS = {
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  " ": 32,
  Escape: 27,
  p: 80,
  Enter: 13,
  Tab: 9,
};

const page = {
  send,
  errors,
  sleep,
  async viewport(
    width,
    height,
    { mobile = false, dark = false, landscape } = {},
  ) {
    const orientation =
      landscape === undefined
        ? undefined
        : {
            type: landscape ? "landscapePrimary" : "portraitPrimary",
            angle: landscape ? 90 : 0,
          };
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenOrientation: orientation,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    await send("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-color-scheme", value: dark ? "dark" : "light" },
      ],
    });
  },
  async goto(url) {
    await send("Page.navigate", { url });
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if ((await page.eval("document.readyState")) === "complete") break;
    }
    await sleep(500);
  },
  async eval(expression) {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw new Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    return r.result.value;
  },
  async click(selector) {
    await page.eval(
      `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: "nearest" })`,
    );
    const box =
      await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!box) throw new Error(`No element: ${selector}`);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type,
        x: box.x,
        y: box.y,
        button: "left",
        clickCount: 1,
      });
    }
    await sleep(150);
  },
  async key(key) {
    const code = KEYS[key] ?? key.toUpperCase().charCodeAt(0);
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      windowsVirtualKeyCode: code,
      text:
        key === "Enter"
          ? String.fromCharCode(13)
          : key.length === 1
            ? key
            : undefined,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      windowsVirtualKeyCode: code,
    });
    await sleep(60);
  },
  /** Center of the first element matching selector (viewport coords), or null. */
  async center(selector) {
    return page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  },
  async touch(type, points) {
    await send("Input.dispatchTouchEvent", { type, touchPoints: points });
  },
  async tap(selector) {
    // Like a real user: scroll the target into view first.
    await page.eval(
      `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: "nearest" })`,
    );
    await sleep(100);
    const c = await page.center(selector);
    if (!c) throw new Error(`No element: ${selector}`);
    await page.touch("touchStart", [{ x: c.x, y: c.y }]);
    await page.touch("touchEnd", []);
    await sleep(200);
  },
  async swipe(selector, dx, dy) {
    const c = await page.eval(
      `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
    );
    await send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: c.x, y: c.y }],
    });
    for (let i = 1; i <= 5; i++) {
      await send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: c.x + (dx * i) / 5, y: c.y + (dy * i) / 5 }],
      });
    }
    await send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await sleep(250);
  },
  async screenshot(name, fullPage = false) {
    const params = { format: "png", captureBeyondViewport: fullPage };
    const { data } = await send("Page.captureScreenshot", params);
    const file = join(OUT, `${name}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    return file;
  },
};

let code = 0;
try {
  const scenario = (await import(pathToFileURL(resolve(process.argv[2])).href))
    .default;
  await scenario(page);
} catch (e) {
  console.error("SCENARIO FAILED:", e.message);
  code = 1;
} finally {
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
  ws.close();
  edge.kill();
  process.exit(code);
}
