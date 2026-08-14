import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function redirectUri(request: NextRequest) {
  return process.env.THREADS_REDIRECT_URI || `${new URL(request.url).origin}/api/threads/oauth/callback`;
}

export async function GET(request: NextRequest) {
  const appId = process.env.THREADS_APP_ID;
  if (!appId) return Response.json({ error: "На сервере не настроен THREADS_APP_ID" }, { status: 503 });
  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://threads.net/oauth/authorize");
  authorize.searchParams.set("client_id", appId);
  authorize.searchParams.set("redirect_uri", redirectUri(request));
  authorize.searchParams.set("scope", "threads_basic,threads_content_publish,threads_manage_insights");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);
  const response = NextResponse.redirect(authorize);
  response.cookies.set("threads_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/threads/oauth/callback",
    maxAge: 10 * 60,
  });
  return response;
}
