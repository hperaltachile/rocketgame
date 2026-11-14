import { describe, expect, it } from "vitest";
import { COURIERS, SUIT_PRICE, dressed, getCourier } from "./couriers";
import {
  DAILY_REWARD,
  MAX_UPGRADE,
  applyRun,
  buyCourier,
  buySuit,
  buyUpgrade,
  dailyFor,
  dailyMission,
  dayKey,
  missionText,
  missionsFor,
  newSave,
  parseSave,
  rankMultiplier,
  setReward,
  upgradePrice,
  type RunResult,
} from "./progress";

const DAY = "2026-11-14";

function result(over: Partial<RunResult> = {}): RunResult {
  return {
    jumps: 0,
    slides: 0,
    stardust: 0,
    powerUps: 0,
    freightersDodged: 0,
    stumbles: 0,
    distance: 0,
    score: 0,
    ...over,
  };
}

/** A run big enough to finish any early mission. */
const HUGE = result({
  jumps: 999,
  slides: 999,
  stardust: 9999,
  powerUps: 99,
  freightersDodged: 99,
  distance: 99999,
  score: 99999,
});

describe("missions", () => {
  it("come in sets of three different missions, the same every time", () => {
    for (let set = 0; set < 30; set++) {
      const a = missionsFor(set);
      expect(a).toHaveLength(3);
      expect(new Set(a.map((m) => m.kind)).size).toBe(3);
      expect(missionsFor(set)).toEqual(a);
      for (const m of a) expect(m.target).toBeGreaterThan(0);
    }
  });

  it("start easy: no freighter missions before freighters are common", () => {
    for (let set = 0; set < 3; set++)
      expect(missionsFor(set).some((m) => m.kind === "freighters")).toBe(false);
  });

  it("get bigger in later sets", () => {
    const total = (set: number) =>
      missionsFor(set)
        .filter((m) => m.kind === "distance" || m.kind === "stardust")
        .reduce((s, m) => s + m.target, 0);
    expect(total(20) || 1).toBeGreaterThan(total(0));
  });

  it("read nicely", () => {
    expect(missionText({ kind: "slides", oneRun: false, target: 20 })).toBe(
      "Slide 20 times",
    );
    expect(missionText({ kind: "distance", oneRun: true, target: 1500 })).toBe(
      "Run 1,500 m in one run",
    );
  });
});

describe("applyRun", () => {
  it("banks stardust and keeps the top 5 scores", () => {
    let save = newSave();
    for (const score of [100, 500, 300, 50, 700, 200, 10])
      save = applyRun(save, result({ score, stardust: 10 }), DAY);
    expect(save.bank).toBeGreaterThanOrEqual(70);
    expect(save.top.map((t) => t.score)).toEqual([700, 500, 300, 200, 100]);
    expect(save.last?.newRecord).toBe(false);
  });

  it("adds up 'total' missions over runs and keeps the best for 'one run'", () => {
    const save = newSave();
    const goals = missionsFor(0);
    const a = applyRun(
      save,
      result({ jumps: 3, slides: 3, stardust: 3, distance: 100 }),
      DAY,
    );
    const b = applyRun(
      a,
      result({ jumps: 3, slides: 3, stardust: 3, distance: 50 }),
      DAY,
    );
    goals.forEach((m, i) => {
      if (m.oneRun) expect(b.missionProgress[i]).toBe(a.missionProgress[i]);
      else expect(b.missionProgress[i]).toBe(a.missionProgress[i] * 2);
    });
  });

  it("finishing all three missions ranks you up and pays a reward", () => {
    const after = applyRun(newSave(), HUGE, DAY);
    expect(after.rank).toBe(1);
    expect(rankMultiplier(after.rank)).toBe(2);
    expect(after.missionProgress).toEqual([0, 0, 0]);
    expect(after.last?.rankUp).toBe(true);
    expect(after.last?.missionsDone).toHaveLength(3);
    expect(after.bank).toBe(HUGE.stardust + setReward(0) + DAILY_REWARD);
  });

  it("pays the Daily Delivery once a day, and a new day starts fresh", () => {
    const once = applyRun(newSave(), HUGE, DAY);
    expect(once.daily.done).toBe(true);
    const twice = applyRun(once, HUGE, DAY);
    expect(twice.last?.dailyDone).toBe(false);
    expect(dailyFor(twice, "2026-11-15").done).toBe(false);
    const tomorrow = applyRun(twice, HUGE, "2026-11-15");
    expect(tomorrow.last?.dailyDone).toBe(true);
  });

  it("remembers the best distance", () => {
    const a = applyRun(newSave(), result({ distance: 800 }), DAY);
    expect(a.bestDistance).toBe(800);
    expect(a.last?.newBestDistance).toBe(false); // the first run isn't news
    const b = applyRun(a, result({ distance: 900 }), DAY);
    expect(b.last?.newBestDistance).toBe(true);
    const c = applyRun(b, result({ distance: 100 }), DAY);
    expect(c.bestDistance).toBe(900);
  });

  it("doesn't change the save it was given", () => {
    const save = newSave();
    applyRun(save, HUGE, DAY);
    expect(save).toEqual(newSave());
  });
});

describe("daily", () => {
  it("is picked by date", () => {
    expect(dailyMission(DAY)).toEqual(dailyMission(DAY));
    const kinds = new Set(
      Array.from(
        { length: 14 },
        (_, d) => dailyMission(`2026-11-${10 + d}`).kind,
      ),
    );
    expect(kinds.size).toBeGreaterThan(2);
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("shop", () => {
  const rich = { ...newSave(), bank: 100000 };

  it("sells couriers once, only if you can afford them", () => {
    expect(buyCourier(newSave(), "zuri")).toBeNull();
    const bought = buyCourier(rich, "zuri")!;
    expect(bought.owned).toContain("zuri");
    expect(bought.courier).toBe("zuri");
    expect(bought.bank).toBe(100000 - getCourier("zuri").price);
    expect(buyCourier(bought, "zuri")).toBeNull();
  });

  it("sells suits for couriers you own", () => {
    const suit = getCourier("pip").suits[1].id;
    const bought = buySuit(rich, "pip", suit)!;
    expect(bought.bank).toBe(100000 - SUIT_PRICE);
    expect(bought.wearing.pip).toBe(suit);
    expect(buySuit(bought, "pip", suit)).toBeNull();
    expect(buySuit(rich, "bix", getCourier("bix").suits[1].id)).toBeNull();
    expect(dressed(getCourier("pip"), suit).colors).toEqual(
      getCourier("pip").suits[1].colors,
    );
  });

  it("sells upgrades up to the top level, each pricier than the last", () => {
    let save = rich;
    for (let level = 0; level < MAX_UPGRADE; level++) {
      const next = buyUpgrade(save, "magnet")!;
      expect(next.bank).toBe(save.bank - upgradePrice(level));
      save = next;
    }
    expect(save.upgrades.magnet).toBe(MAX_UPGRADE);
    expect(buyUpgrade(save, "magnet")).toBeNull();
    expect(upgradePrice(1)).toBeGreaterThan(upgradePrice(0));
  });
});

describe("parseSave", () => {
  it("starts fresh with nothing saved or junk saved", () => {
    expect(parseSave(null)).toEqual(newSave());
    expect(parseSave("not json")).toEqual(newSave());
    expect(parseSave("42")).toEqual(newSave());
  });

  it("round-trips a real save", () => {
    let save = applyRun({ ...newSave(), bank: 5000 }, HUGE, DAY);
    save = buyCourier(save, "zuri")!;
    save = buyUpgrade(save, "warp")!;
    save = { ...save, last: null };
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });

  it("repairs bad values instead of trusting them", () => {
    const save = parseSave(
      JSON.stringify({
        bank: -50,
        owned: ["bix", "hacker"],
        courier: "zuri",
        upgrades: { warp: 99, magnet: "lots" },
        rank: 1e9,
        wearing: { pip: "not-a-suit" },
        top: [{ score: 5 }, null, "x"],
      }),
    );
    expect(save.bank).toBe(0);
    expect(save.owned).toEqual(["pip", "bix"]);
    expect(save.courier).toBe("pip"); // zuri isn't owned
    expect(save.upgrades.warp).toBe(MAX_UPGRADE);
    expect(save.upgrades.magnet).toBe(0);
    expect(save.wearing.pip).toBe(COURIERS[0].suits[0].id);
    expect(save.top).toHaveLength(1);
  });
});
