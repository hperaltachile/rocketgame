import { describe, expect, it } from "vitest";
import {
  hitsSelf,
  newSnake,
  placeStar,
  step,
  tickMs,
  turn,
  type Point,
  type Snake,
} from "./logic";

function snakeAt(
  body: Point[],
  dir: Snake["dir"],
  star: Point = { x: 0, y: 0 },
): Snake {
  return { size: 10, body, dir, queue: [], star, score: 0, alive: true };
}

const row = (y: number, ...xs: number[]) => xs.map((x) => ({ x, y }));

describe("self-collision", () => {
  it("hitsSelf detects a head on any body cell", () => {
    expect(hitsSelf({ x: 2, y: 3 }, row(3, 5, 4, 3, 2))).toBe(true);
    expect(hitsSelf({ x: 2, y: 4 }, row(3, 5, 4, 3, 2))).toBe(false);
  });

  it("dies when turning into its own body", () => {
    // A length-5 snake curled so that going down hits its own body.
    const snake = snakeAt(
      [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
      ],
      "left",
    );
    const { snake: after, died } = step(turn(snake, "down"));
    expect(died).toBe(true);
    expect(after.alive).toBe(false);
  });

  it("may move into the cell its tail is leaving", () => {
    // Square loop: head moves onto the tail's cell as the tail moves away.
    const snake = snakeAt(
      [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
      ],
      "left",
    );
    const { died } = step(turn(snake, "down"));
    expect(died).toBe(false);
  });

  it("but not when it is growing on that step", () => {
    const snake = snakeAt(
      [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
      ],
      "left",
      { x: 3, y: 4 },
    );
    expect(step(turn(snake, "down")).died).toBe(true);
  });
});

describe("movement", () => {
  it("moves one cell in its direction, keeping its length", () => {
    const { snake } = step(snakeAt(row(5, 4, 3, 2), "right", { x: 9, y: 9 }));
    expect(snake.body).toEqual(row(5, 5, 4, 3));
  });

  it("dies at the walls", () => {
    expect(step(snakeAt(row(5, 9, 8, 7), "right")).died).toBe(true);
    expect(
      step(
        snakeAt(
          [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
          ],
          "up",
        ),
      ).died,
    ).toBe(true);
  });

  it("ignores reversing straight into its neck", () => {
    const snake = snakeAt(row(5, 4, 3, 2), "right");
    expect(turn(snake, "left")).toBe(snake);
  });

  it("queues quick turns and applies one per step", () => {
    let snake = snakeAt(row(5, 4, 3, 2), "right", { x: 9, y: 9 });
    snake = turn(turn(snake, "up"), "left");
    expect(snake.queue).toEqual(["up", "left"]);
    snake = step(snake).snake;
    expect(snake.body[0]).toEqual({ x: 4, y: 4 });
    snake = step(snake).snake;
    expect(snake.body[0]).toEqual({ x: 3, y: 4 });
  });
});

describe("eating stars", () => {
  it("grows by one, scores, and places a new star off the snake", () => {
    const { snake, ate } = step(
      snakeAt(row(5, 4, 3, 2), "right", { x: 5, y: 5 }),
      () => 0.5,
    );
    expect(ate).toBe(true);
    expect(snake.body).toHaveLength(4);
    expect(snake.score).toBe(1);
    expect(hitsSelf(snake.star, snake.body)).toBe(false);
  });

  it("placeStar never picks a snake cell", () => {
    const body = row(0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
    for (const r of [0, 0.3, 0.7, 0.999]) {
      const star = placeStar(body, 10, () => r)!;
      expect(hitsSelf(star, body)).toBe(false);
    }
  });

  it("new game starts alive with a free star", () => {
    const snake = newSnake(() => 0.42);
    expect(snake.alive).toBe(true);
    expect(snake.body).toHaveLength(3);
    expect(hitsSelf(snake.star, snake.body)).toBe(false);
  });
});

describe("speed", () => {
  it("speeds up as the snake grows, down to a floor", () => {
    expect(tickMs(3)).toBe(150);
    expect(tickMs(10)).toBeLessThan(tickMs(4));
    expect(tickMs(500)).toBe(60);
  });
});
