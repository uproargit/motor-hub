"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authConfig, createSessionToken, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE } from "../auth";
import type { FormState } from "./shared";

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const config = authConfig();
  if (!config) redirect("/");

  const submitted = String(formData.get("password") ?? "");
  if (!(await safeEqual(submitted, config.password))) {
    // Deliberately vague: it is the only signal an attacker would get.
    return { error: "That passphrase is not right." };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(config), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  const next = String(formData.get("next") ?? "/");
  // Only ever return to a path on this site.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
