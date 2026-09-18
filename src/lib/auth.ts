/**
 * Access control for a household.
 *
 * One shared passphrase, held in MOTOR_HUB_PASSWORD, exchanged for a signed
 * session cookie. There are no per-person accounts because there is nothing in
 * the app that differs per person — every family member sees the same garage.
 * Swapping this for real accounts later means adding a user table and an owner
 * column; nothing here assumes a single user.
 *
 * Uses Web Crypto rather than node:crypto so the same code runs in middleware.
 */

export const SESSION_COOKIE = "motor_hub_session";
const SESSION_DAYS = 30;

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function encoder(): TextEncoder {
  return new TextEncoder();
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder().encode(value)));
}

/**
 * Compares by signing both sides and checking the digests, which takes the same
 * time regardless of where the first differing character is.
 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const salt = crypto.randomUUID();
  const [left, right] = await Promise.all([sign(a, salt), sign(b, salt)]);
  return left === right;
}

export interface AuthConfig {
  password: string;
  secret: string;
}

/**
 * Returns null when no passphrase is set, which is how local development runs
 * unauthenticated. Deployments are checked at build time by `npm run check:env`.
 */
export function authConfig(): AuthConfig | null {
  const password = process.env.MOTOR_HUB_PASSWORD;
  if (!password) return null;

  // Falling back to the passphrase keeps setup to one variable; setting a
  // separate secret means changing the passphrase does not invalidate sessions.
  const secret = process.env.MOTOR_HUB_SESSION_SECRET ?? `session:${password}`;
  return { password, secret };
}

export function isAuthDisabled(): boolean {
  return authConfig() == null;
}

/** `<expires>.<signature>` — stateless, so no session store is needed. */
export async function createSessionToken(config: AuthConfig, now = Date.now()): Promise<string> {
  const expires = String(now + SESSION_MAX_AGE * 1000);
  return `${expires}.${await sign(expires, config.secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  config: AuthConfig,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const expires = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!/^\d+$/.test(expires) || Number(expires) < now) return false;

  return safeEqual(signature, await sign(expires, config.secret));
}

/**
 * Whether the current request carries a valid session. Used to decide whether
 * to offer a sign-out control; access itself is enforced in middleware.
 */
export async function isSignedIn(cookieValue: string | undefined): Promise<boolean> {
  const config = authConfig();
  if (!config) return false;
  return verifySessionToken(cookieValue, config);
}
