import { createHmac, timingSafeEqual } from "node:crypto";

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export async function verifyMetaSignedRequest(request: Request) {
  const secret = process.env.THREADS_APP_SECRET;
  if (!secret) throw new Error("THREADS_APP_SECRET не настроен");

  const contentType = request.headers.get("content-type") || "";
  let signedRequest = "";
  if (contentType.includes("application/json")) {
    const payload = await request.json() as { signed_request?: unknown };
    signedRequest = typeof payload.signed_request === "string" ? payload.signed_request : "";
  } else {
    const form = await request.formData();
    const value = form.get("signed_request");
    signedRequest = typeof value === "string" ? value : "";
  }

  const [encodedSignature, encodedPayload] = signedRequest.split(".");
  if (!encodedSignature || !encodedPayload) throw new Error("Meta не передала signed_request");
  const signature = decodeBase64Url(encodedSignature);
  const expected = createHmac("sha256", secret).update(encodedPayload).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new Error("Подпись запроса Meta недействительна");
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as Record<string, unknown>;
  if (typeof payload.algorithm === "string" && payload.algorithm.toUpperCase() !== "HMAC-SHA256") {
    throw new Error("Алгоритм подписи Meta не поддерживается");
  }
  return payload;
}

export function signedRequestUserId(payload: Record<string, unknown>) {
  const value = payload.user_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
