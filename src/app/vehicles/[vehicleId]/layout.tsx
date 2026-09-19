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
          <Link href="/vehicles" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            Vehicles
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="display text-3xl text-ink">{vehicleTitle(vehicle)}</h1>
            {vehicle.archived ? <Pill tone="muted">Archived</Pill> : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {vehicle.nickname ? `${vehicleDescription(vehicle)}, ` : ""}
            {type.label}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <dl className="flex gap-6 text-right">
            {vehicle.tracks_mileage ? (
              <div>
                <dt className="text-sm text-muted">Odometer</dt>
                <dd className="readout text-xl text-ink">{formatMiles(vehicle.current_mileage)}</dd>
              </div>
            ) : null}
            {vehicle.tracks_engine_hours ? (
              <div>
                <dt className="text-sm text-muted">Engine hours</dt>
                <dd className="readout text-xl text-ink">{formatHours(vehicle.current_engine_hours)}</dd>
              </div>
            ) : null}
          </dl>
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
