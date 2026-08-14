import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { threadsSettings } from "../../../../../db/schema";
import { encryptToken } from "../../../../../lib/threads/crypto";
import { getThreadsSettingsRow } from "../../../../../lib/threads/data";

function redirectUri(request: NextRequest) {
  return process.env.THREADS_REDIRECT_URI || `${new URL(request.url).origin}/api/threads/oauth/callback`;
}

function finish(request: NextRequest, status: "connected" | "error", message = "") {
  const url = new URL("/threads", request.url);
  url.searchParams.set("oauth", status);
  if (message) url.searchParams.set("message", message.slice(0, 180));
  const response = NextResponse.redirect(url);
  response.cookies.delete("threads_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const error = params.get("error_message") || params.get("error");
    if (error) return finish(request, "error", error);
    const code = params.get("code")?.split("#")[0] || "";
    const state = params.get("state") || "";
    if (!code && !state) {
      return Response.json({ ok: true, endpoint: "threads-oauth-callback" });
    }
    if (!code || !state || state !== request.cookies.get("threads_oauth_state")?.value) {
      return finish(request, "error", "Проверка безопасности авторизации не пройдена");
    }
    const appId = process.env.THREADS_APP_ID;
    const appSecret = process.env.THREADS_APP_SECRET;
    if (!appId || !appSecret) return finish(request, "error", "На сервере не настроены данные приложения Meta");

    const shortResponse = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(request),
        code,
      }),
      cache: "no-store",
    });
    const short = await shortResponse.json() as { access_token?: string; user_id?: string | number; error_message?: string; error?: { message?: string } };
    if (!shortResponse.ok || !short.access_token) throw new Error(short.error?.message || short.error_message || "Meta не выдала токен доступа");

    const exchange = new URL("https://graph.threads.net/access_token");
    exchange.searchParams.set("grant_type", "th_exchange_token");
    exchange.searchParams.set("client_secret", appSecret);
    exchange.searchParams.set("access_token", short.access_token);
    const longResponse = await fetch(exchange, { cache: "no-store" });
    const long = await longResponse.json() as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!longResponse.ok || !long.access_token) throw new Error(long.error?.message || "Не удалось получить долгосрочный токен Threads");

    const meResponse = await fetch("https://graph.threads.net/v1.0/me?fields=id,username,name", {
      headers: { Authorization: `Bearer ${long.access_token}` },
      cache: "no-store",
    });
    const me = await meResponse.json() as { id?: string; username?: string; error?: { message?: string } };
    if (!meResponse.ok || !me.id) throw new Error(me.error?.message || "Не удалось получить профиль Threads");
    const encrypted = encryptToken(long.access_token);
    await getThreadsSettingsRow();
    await getDb().update(threadsSettings).set({
      threadsUserId: me.id,
      threadsUsername: me.username || "",
      tokenEncrypted: encrypted.encrypted,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenExpiresAt: new Date(Date.now() + Math.max(60, Number(long.expires_in) || 5_184_000) * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(threadsSettings.id, 1));
    return finish(request, "connected");
  } catch (error) {
    return finish(request, "error", error instanceof Error ? error.message : "Ошибка подключения Threads");
  }
}
