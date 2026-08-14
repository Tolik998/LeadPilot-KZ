import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedToken = { encrypted: string; iv: string; authTag: string };

function encryptionKey() {
  const secret = process.env.THREADS_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("На сервере не настроен THREADS_TOKEN_ENCRYPTION_KEY длиной не менее 32 символов");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptToken(token: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(value: EncryptedToken) {
  if (!value.encrypted || !value.iv || !value.authTag) throw new Error("Аккаунт Threads не подключён");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
