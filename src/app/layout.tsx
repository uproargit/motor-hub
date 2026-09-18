import type { Metadata } from "next";
import Link from "next/link";

import { cookies } from "next/headers";

import { signOutAction } from "@/lib/actions/auth";
import { isSignedIn, SESSION_COOKIE } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Motor Hub",
  description: "Build sheets, parts history and maintenance tracking for every vehicle you own.",
};

// Same reason as the login page: the sign-out control depends on runtime
// configuration, so this layout must not be prerendered.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/maintenance", label: "Maintenance" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isSignedIn((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink">
              <span aria-hidden className="text-lg">
                🔧
              </span>
              Motor Hub
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 font-medium text-muted transition hover:bg-raised hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {signedIn ? (
              <form action={signOutAction} className="ml-auto">
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-raised hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-7">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-faint">
          Every part, every receipt, every service — kept for the life of the vehicle.
        </footer>
      </body>
    </html>
  );
}
