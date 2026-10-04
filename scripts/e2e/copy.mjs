const BASE = process.env.BASE ?? "http://localhost:3123";
export default async function scenario(page) {
  for (const [w, h, dark, tag] of [
    [375, 900, true, "375-dark"],
    [1280, 900, false, "1280-light"],
  ]) {
    await page.viewport(w, h, { mobile: w < 500, dark });
    for (const path of ["/", "/about"]) {
      await page.goto(BASE + path);
      const sw = await page.eval("document.documentElement.scrollWidth");
      console.log(
        `${path} @${tag}: scrollWidth ${sw} ${sw <= w ? "ok" : "OVERFLOW"}`,
      );
      await page.screenshot(
        `copy${path === "/" ? "-home" : "-about"}-${tag}`,
        true,
      );
    }
  }
  for (const path of ["/", "/about"]) {
    await page.goto(BASE + path);
    const d = await page.eval(
      `document.querySelector('meta[name=description]').content`,
    );
    console.log(`${path} meta (${d.length}): ${d}`);
    console.log(`${path} title: ${await page.eval("document.title")}`);
  }
}
