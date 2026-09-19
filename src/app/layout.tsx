import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";

import { cookies } from "next/headers";

import { ThemeToggle } from "@/components/theme-toggle";
import { signOutAction } from "@/lib/actions/auth";
import { isSignedIn, SESSION_COOKIE } from "@/lib/auth";

import "./globals.css";

// One family across the whole app, carrying its own width axis: headings are
// set expanded, everything else normal. Tabular figures matter more here than a
// second typeface would.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

/**
 * Applies the stored appearance before first paint. Without it a reader who
 * chose Night sees a bone-white flash on every navigation.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("motor-hub-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

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
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="display text-base text-ink">
              Motor Hub
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-2 py-1 font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            {signedIn ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline"
                >
                  Sign out
                </button>
              </form>
            ) : null}
            </div>
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
