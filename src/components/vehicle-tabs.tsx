"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function VehicleTabs({ vehicleId }: { vehicleId: string }) {
  const pathname = usePathname();
  const base = `/vehicles/${vehicleId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/build-sheet`, label: "Build Sheet" },
    { href: `${base}/parts`, label: "Parts" },
    { href: `${base}/maintenance`, label: "Maintenance" },
    { href: `${base}/history`, label: "History" },
  ];

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-line" aria-label="Vehicle sections">
      {tabs.map((tab) => {
        const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
