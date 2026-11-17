import { NextResponse, type NextRequest } from "next/server";

// Protection facultative par mot de passe (HTTP Basic) : active seulement si APP_PASSWORD est défini.
export function middleware(req: NextRequest) {
  const motDePasse = process.env.APP_PASSWORD;
  if (!motDePasse) return NextResponse.next();
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    try {
      const [, pass] = atob(auth.slice(6)).split(/:(.*)/s);
      if (pass === motDePasse) return NextResponse.next();
    } catch {
      /* en-tête invalide */
    }
  }
  return new NextResponse("Accès protégé", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Pilote", charset="UTF-8"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"] };
