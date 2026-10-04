/** Pure Snake rules on a square grid. `rng` is injectable for tests. */

import type { Direction } from "../../input";

export type { Direction };
export type Point = { x: number; y: number };
export type Rng = () => number;

export const GRID_SIZE = 18;
export const MAX_QUEUED_TURNS = 2;

export type Snake = {
  size: number;
  /** Head first. */
  body: Point[];
  dir: Direction;
  /** Turns pressed faster than the snake moves, applied one per step. */
  queue: Direction[];
  star: Point;
  score: number;
  alive: boolean;
};

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function hitsSelf(head: Point, body: Point[]): boolean {
  return body.some((p) => samePoint(p, head));
}

export function placeStar(body: Point[], size: number, rng: Rng): Point | null {
  const free: Point[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!hitsSelf({ x, y }, body)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

export function newSnake(rng: Rng = Math.random, size = GRID_SIZE): Snake {
  const y = Math.floor(size / 2);
  const x = Math.floor(size / 3);
  const body = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ];
  return {
    size,
    body,
    dir: "right",
    queue: [],
    star: placeStar(body, size, rng)!,
    score: 0,
    alive: true,
  };
}

/** Queues a turn. Ignores repeats and instant reversals into the neck. */
export function turn(snake: Snake, dir: Direction): Snake {
  const last = snake.queue.at(-1) ?? snake.dir;
  if (
    !snake.alive ||
    dir === last ||
    dir === OPPOSITE[last] ||
    snake.queue.length >= MAX_QUEUED_TURNS
  ) {
    return snake;
  }
  return { ...snake, queue: [...snake.queue, dir] };
}

export type StepResult = { snake: Snake; ate: boolean; died: boolean };

export function step(snake: Snake, rng: Rng = Math.random): StepResult {
  if (!snake.alive) return { snake, ate: false, died: false };

  const [nextDir, ...queue] = snake.queue.length ? snake.queue : [snake.dir];
  const head = snake.body[0];
  const next = { x: head.x + DELTA[nextDir].x, y: head.y + DELTA[nextDir].y };

  const ate = samePoint(next, snake.star);
  // The tail moves out of the way this step unless the snake is growing.
  const rest = ate ? snake.body : snake.body.slice(0, -1);
  const outside =
    next.x < 0 || next.y < 0 || next.x >= snake.size || next.y >= snake.size;

  if (outside || hitsSelf(next, rest)) {
    return {
      snake: { ...snake, dir: nextDir, queue, alive: false },
      ate: false,
      died: true,
    };
  }

  const body = [next, ...rest];
  const star = ate ? placeStar(body, snake.size, rng) : snake.star;
  return {
    snake: {
      ...snake,
      body,
      dir: nextDir,
      queue,
      // A full board (no room for a star) ends the game as a win.
      star: star ?? snake.star,
      score: snake.score + (ate ? 1 : 0),
      alive: star !== null,
    },
    ate,
    died: false,
  };
}

/** Milliseconds per step: faster as the snake grows, with a floor. */
export function tickMs(length: number): number {
  return Math.max(60, 150 - (length - 3) * 4);
}
