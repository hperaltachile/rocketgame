import { ipAddress } from "@vercel/functions";
import type { NextRequest } from "next/server";
import {
  getTop,
  hashIp,
  NotConfiguredError,
  overRateLimit,
  submitScore,
} from "@/lib/leaderboard/db";
import { boardGame, validateSubmission } from "@/lib/leaderboard/rules";

const NO_STORE = { "Cache-Control": "no-store" };

function failure(error: unknown): Response {
  if (error instanceof NotConfiguredError) {
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  console.error("leaderboard:", error);
  return Response.json({ error: "server" }, { status: 500, headers: NO_STORE });
}

/** Only the site's own pages may save scores. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/leaderboard/[slug]">,
) {
  const { slug } = await ctx.params;
  const game = boardGame(slug);
  if (!game) {
    return Response.json({ error: "game" }, { status: 404, headers: NO_STORE });
  }
  try {
    const board = await getTop(game);
    return Response.json(
      { board },
      {
        headers: {
          // The CDN serves the board for 30 s, so busy pages barely touch the database.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/leaderboard/[slug]">,
) {
  const { slug } = await ctx.params;
  if (!boardGame(slug)) {
    return Response.json({ error: "game" }, { status: 404, headers: NO_STORE });
  }
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "origin" },
      { status: 403, headers: NO_STORE },
    );
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "body" }, { status: 400, headers: NO_STORE });
  }
  const check = validateSubmission({
    slug,
    name: body.name,
    score: body.score,
    playerId: body.playerId,
  });
  if (!check.ok) {
    return Response.json(
      { error: check.reason },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const ip =
      ipAddress(request) ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (await overRateLimit(hashIp(ip))) {
      return Response.json(
        { error: "slow-down" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } },
      );
    }
    const result = await submitScore(
      check.game,
      check.playerId,
      check.name,
      check.score,
    );
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
