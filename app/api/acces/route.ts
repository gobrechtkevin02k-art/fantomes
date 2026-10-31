import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, idValide, lireCookie, sessionPayee, signer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const id = lireCookie((await cookies()).get(COOKIE)?.value);
  if (!id) return NextResponse.json({ acces: false });
  try { return NextResponse.json({ acces: (await sessionPayee(id)).ok }); }
  catch { return NextResponse.json({ acces: false }); }
}

export async function POST(req: Request) {
  const { session_id } = await req.json().catch(() => ({}));
  if (typeof session_id !== "string" || !idValide(session_id)) return NextResponse.json({ acces: false }, { status: 400 });
  try {
    const r = await sessionPayee(session_id);
    if (!r.ok) return NextResponse.json({ acces: false });
    const res = NextResponse.json({ acces: true });
    res.cookies.set(COOKIE, signer(session_id), {
      httpOnly: true, secure: true, sameSite: "lax", path: "/",
      maxAge: r.mode === "subscription" ? 60 * 60 * 24 * 365 : 60 * 60 * 24 * 30,
    });
    return res;
  } catch { return NextResponse.json({ acces: false }, { status: 500 }); }
}
