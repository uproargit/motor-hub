import { NextResponse, type NextRequest } from "next/server";

import { authConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Everything is private, including uploaded receipts and photos. Only the login
 * page and Next's own assets are reachable without a session.
 */
export async function middleware(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, config)) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  // Send the user back where they were headed once they are in.
  if (pathname !== "/") login.searchParams.set("next", pathname);

  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
