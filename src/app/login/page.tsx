import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { isAuthDisabled } from "@/lib/auth";

export const metadata = { title: "Sign in · Motor Hub" };

// Whether a passphrase is configured is a runtime fact. Without this the page
// is prerendered at build time, when the environment is not yet set, and the
// "auth is off" branch gets baked in — which sends every visitor into a
// redirect loop between /login and /.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (isAuthDisabled()) redirect("/");

  const { next } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16">
      <div className="text-center">
        <span aria-hidden className="text-4xl">
          🔧
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">Motor Hub</h1>
        <p className="mt-1 text-sm text-muted">Enter the family passphrase to continue.</p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
