import Link from "next/link";
import { notFound } from "next/navigation";

import { VehicleTabs } from "@/components/vehicle-tabs";
import { Pill } from "@/components/ui";
import { VEHICLE_TYPES } from "@/lib/domain";
import { formatHours, formatMiles } from "@/lib/format";
import { vehicleDescription, vehicleTitle } from "@/lib/part-logic";
import { getVehicle } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function VehicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const type = VEHICLE_TYPES[vehicle.vehicle_type];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/vehicles" className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-ink">
            ← Vehicles
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <span aria-hidden className="text-2xl">
              {type.icon}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{vehicleTitle(vehicle)}</h1>
            {vehicle.archived ? <Pill tone="muted">Archived</Pill> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {vehicle.nickname ? `${vehicleDescription(vehicle)} · ` : ""}
            {type.label}
            {vehicle.tracks_mileage ? ` · ${formatMiles(vehicle.current_mileage)}` : ""}
            {vehicle.tracks_engine_hours ? ` · ${formatHours(vehicle.current_engine_hours)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/vehicles/${vehicle.id}/parts/new`} className="btn-primary">
            Add part
          </Link>
          <Link href={`/vehicles/${vehicle.id}/edit`} className="btn-secondary">
            Edit
          </Link>
        </div>
      </header>

      <VehicleTabs vehicleId={vehicle.id} />

      {children}
    </div>
  );
}
