import { NextRequest, NextResponse } from "next/server";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function proxy(request: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("LeadPilot access is not configured", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      const separator = decoded.indexOf(":");
      const suppliedUser = separator >= 0 ? decoded.slice(0, separator) : "";
      const suppliedPassword = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (safeEqual(suppliedUser, username) && safeEqual(suppliedPassword, password)) {
        return NextResponse.next();
      }
    } catch {
      // Invalid Basic authorization value: return the normal login challenge.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LeadPilot KZ", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|og.png|t/|api/cron/threads|api/threads/oauth/callback|api/threads/oauth/deauthorize|api/threads/oauth/delete).*)"],
};
