"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Auto", light: "Day", dark: "Night" };

/**
 * Light, dark, or whatever the machine says. The choice is kept in
 * localStorage and written to <html data-theme>, which is what the palette
 * keys off. An inline script in the layout applies it before first paint, so
 * the label starts blank here until this mounts rather than flashing "Auto"
 * over a dark page.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("motor-hub-theme");
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  function choose(next: Theme) {
    setTheme(next);

    try {
      if (next === "system") window.localStorage.removeItem("motor-hub-theme");
      else window.localStorage.setItem("motor-hub-theme", next);
    } catch {
      // Private browsing: the choice just will not persist.
    }

    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }

  const current = theme ?? "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Appearance: ${LABEL[current].toLowerCase()}. Switch to ${LABEL[next].toLowerCase()}.`}
      className="border border-line px-2.5 py-1 text-xs font-semibold tracking-wide text-muted transition hover:border-line-strong hover:text-ink"
    >
      {theme ? LABEL[theme] : "    "}
    </button>
  );
}
