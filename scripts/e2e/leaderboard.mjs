// Leaderboard: play 2048 to the end, save the score with a built name, see it
// on the Top 10, and check the API turns away bad saves.
// Needs a server with a database (DATABASE_URL) and the tables from
// scripts/db/schema.sql; use a throwaway database, as this writes scores.
const BASE = process.env.BASE ?? "http://localhost:3123";

export default async function scenario(page) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
    console.log("ok -", msg);
  };
  const overlay = () =>
    page.eval(
      `document.querySelector("[role=dialog] h2")?.textContent ?? null`,
    );
  const waitFor = async (expr, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.eval(`!!(${expr})`)) return true;
      await page.sleep(100);
    }
    return false;
  };
  const playToTheEnd = async () => {
    await page.click("[role=dialog] button.btn-primary");
    const keys = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
    for (let i = 0; i < 3000 && (await overlay()) !== "No more moves"; i++) {
      await page.key(keys[Math.floor(Math.random() * 4)]);
      if ((await overlay()) === "Paused") await page.key("p");
    }
    assert((await overlay()) === "No more moves", "2048 played to the end");
  };

  await page.viewport(1280, 900);
  await page.goto(BASE + "/games/2048");
  assert(
    await waitFor(`document.querySelector("#leaderboard-title")`),
    "Top 10 shows under the game",
  );
  const before = await page.eval(
    `document.querySelectorAll("[data-leaderboard] li").length`,
  );

  await playToTheEnd();
  assert(
    await waitFor(`document.querySelector("[data-leaderboard-save]")`, 3000),
    "game-over screen offers to save (the board isn't full)",
  );
  await page.screenshot("leaderboard-prompt");

  // Build a name: open the picker and roll one.
  await page.eval(
    `[...document.querySelectorAll("[data-leaderboard-save] button")].find((b) => b.textContent.includes("Change name")).click()`,
  );
  assert(
    await waitFor(
      `document.querySelectorAll("[data-leaderboard-save] select").length === 3`,
    ),
    "name picker has three lists",
  );
  await page.eval(
    `[...document.querySelectorAll("[data-leaderboard-save] button")].find((b) => b.textContent.includes("Surprise")).click()`,
  );
  await page.sleep(200);
  const name = await page.eval(
    `document.querySelector("[data-leaderboard-save] p:nth-of-type(2) .font-semibold").textContent`,
  );
  assert(
    /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/.test(name),
    `built a name (${name})`,
  );
  await page.screenshot("leaderboard-picker");

  await page.eval(
    `[...document.querySelectorAll("[data-leaderboard-save] button")].find((b) => b.textContent === "Save score").click()`,
  );
  assert(
    await waitFor(`document.querySelector("[data-leaderboard-saved]")`),
    "save confirmed",
  );
  const rank = await page.eval(
    `document.querySelector("[data-leaderboard-saved]").dataset.leaderboardSaved`,
  );
  assert(Number(rank) >= 1, `got a rank (#${rank})`);
  const listed = await page.eval(
    `[...document.querySelectorAll("[data-leaderboard] li")].some((li) => li.textContent.includes(${JSON.stringify(name)}) && li.textContent.includes("you"))`,
  );
  assert(listed, "the Top 10 shows the new row, marked as you");
  const player = await page.eval(
    `JSON.parse(localStorage.getItem("rocketgame:player"))`,
  );
  assert(
    player?.name === name && player.saved?.["2048"] > 0,
    "the browser remembers the name and saved score",
  );

  await page.goto(BASE + "/games/2048");
  assert(
    await waitFor(
      `[...document.querySelectorAll("[data-leaderboard] li")].some((li) => li.textContent.includes(${JSON.stringify(name)}))`,
    ),
    `the score is still there after a reload (${before} rows before)`,
  );

  // The API turns away bad saves (same origin, so only the checks differ).
  const post = (slug, body) =>
    page.eval(`fetch("/api/leaderboard/${slug}", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: ${JSON.stringify(JSON.stringify(body))} }).then((r) => r.status)`);
  const id = player.id;
  assert(
    (await post("2048", {
      name: "Sam from school",
      score: 100,
      playerId: id,
    })) === 400,
    "typed names are refused",
  );
  assert(
    (await post("2048", { name, score: 99_999_999, playerId: id })) === 400,
    "impossible scores are refused",
  );
  assert(
    (await post("tictactoe", { name, score: 3, playerId: id })) === 404,
    "Tic-Tac-Toe has no board",
  );

  // Phone held sideways: the prompt fits (the overlay scrolls) and the page doesn't.
  await page.viewport(740, 360, { mobile: true, dark: true, landscape: true });
  await page.goto(BASE + "/games/2048");
  await page.eval(`localStorage.removeItem("rocketgame:player")`);
  await playToTheEnd();
  const shown = await waitFor(
    `document.querySelector("[data-leaderboard-save]")`,
    3000,
  );
  console.log(
    shown
      ? "ok - prompt shown on a short landscape phone"
      : "note - this run didn't make the Top 10, so no prompt to check",
  );
  const sw = await page.eval("document.documentElement.scrollWidth");
  assert(sw <= 740, `no horizontal scroll (${sw})`);
  await page.screenshot("leaderboard-phone");

  if (page.errors.length) throw new Error("page had errors");
}
