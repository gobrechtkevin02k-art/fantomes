import { NextResponse } from "next/server";
import { scoresDemo } from "@/lib/demo";
import { cleApi, cleSportValide, scoresLive } from "@/lib/oddsapi";
import type { ScoresResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const sports = (u.searchParams.get("sports") ?? "").split(",").filter(cleSportValide).slice(0, 20);
  const jours = Math.min(3, Math.max(1, Number(u.searchParams.get("days")) || 3));
  const forceDemo = u.searchParams.get("demo") === "1";

  if (!cleApi() || forceDemo) {
    const body: ScoresResponse = { source: "demo", fetchedAt: new Date().toISOString(), scores: scoresDemo(sports, Date.now(), jours), errors: [] };
    return NextResponse.json(body);
  }
  const errors: string[] = [];
  const res = await Promise.all(
    sports.map((s) =>
      scoresLive(s, jours).catch((e: Error) => {
        errors.push(`${s} : ${e.message}`);
        return [];
      }),
    ),
  );
  const body: ScoresResponse = { source: "live", fetchedAt: new Date().toISOString(), scores: res.flat(), errors };
  return NextResponse.json(body);
}
