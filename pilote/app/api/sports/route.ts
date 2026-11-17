import { NextResponse } from "next/server";
import { sportsDemo } from "@/lib/demo";
import { cleApi, quota, sportsLive } from "@/lib/oddsapi";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!cleApi()) return NextResponse.json({ source: "demo", sports: sportsDemo(), quota: { remaining: null, used: null } });
  try {
    const sports = await sportsLive();
    return NextResponse.json({ source: "live", sports: sports.filter((s) => s.active && !s.outrights), quota: quota() });
  } catch (e) {
    return NextResponse.json({ source: "live", sports: [], error: (e as Error).message, quota: quota() }, { status: 502 });
  }
}
