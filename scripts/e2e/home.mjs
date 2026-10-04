const BASE = process.env.BASE ?? "http://localhost:3123";
export default async function scenario(page) {
  const assert = (c, m) => {
    if (!c) throw new Error(m);
    console.log("ok -", m);
  };
  for (const [w, h, mobile, name] of [
    [360, 640, true, "android-small"],
    [390, 844, true, "iphone"],
    [768, 1024, true, "ipad"],
    [1024, 768, true, "ipad-landscape"],
    [1280, 800, false, "desktop"],
  ]) {
    await page.viewport(w, h, { mobile, dark: name === "iphone" });
    await page.goto(BASE + "/");
    const sw = await page.eval("document.documentElement.scrollWidth");
    assert(sw <= w, `${name}: no horizontal scroll (${sw})`);
    const cols = await page.eval(
      `getComputedStyle(document.querySelector("#games + ul")).gridTemplateColumns.split(" ").length`,
    );
    const cardH = await page.eval(
      `document.querySelector("#games + ul a").getBoundingClientRect().height`,
    );
    console.log(
      `  ${name}: ${cols} cards per row, card height ${Math.round(cardH)}px`,
    );
    assert(cardH >= 120, `${name}: cards are big tap targets`);
    await page.screenshot(`home-${name}`);
  }
  await page.viewport(1280, 800);
  await page.goto(BASE + "/");
  const js = await page.eval(
    `Math.round(performance.getEntriesByType("resource").filter(r => r.name.endsWith(".js") && !r.name.includes("polyfill")).reduce((s, r) => s + r.encodedBodySize, 0) / 1024)`,
  );
  console.log(`  home JS transferred (excl. polyfills): ${js} KB`);
  const { installabilityErrors: errors } = await page.send(
    "Page.getInstallabilityErrors",
  );
  assert(
    errors.length === 0,
    `installable as an app (${JSON.stringify(errors)})`,
  );
  const m = await page.send("Page.getAppManifest");
  const manifest = JSON.parse(m.data);
  for (const icon of manifest.icons) {
    const status = await page.eval(
      `fetch(${JSON.stringify(icon.src)}).then(r => r.status + " " + r.headers.get("content-type"))`,
    );
    assert(status.startsWith("200"), `icon ${icon.src}: ${status}`);
  }
  const apple = await page.eval(
    `document.querySelector('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]')?.outerHTML`,
  );
  assert(!!apple, `iOS home-screen meta: ${apple}`);
  if (page.errors.length) throw new Error("page had errors");
}
