import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The console's single-password gate (Editor v0, D34). No accounts: the operator enters one password
 * and gets a signed session cookie. The cookie carries no secret — only a signature over a constant
 * and an issue time — so it proves "someone knew the password recently" without storing it.
 */

export const CONSOLE_COOKIE = "console_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const constantTimeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

export function checkPassword(input: unknown, expected: string): boolean {
  return typeof input === "string" && constantTimeEqual(input, expected);
}

/** A signed token: `<issuedAtMs>.<hmac>`. */
export function issueToken(secret: string, now = Date.now()): string {
  const payload = String(now);
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyToken(secret: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!constantTimeEqual(signature, sign(secret, payload))) return false;
  const issued = Number(payload);
  return Number.isFinite(issued) && now - issued < MAX_AGE_MS && issued <= now;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
