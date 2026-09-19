import { notFound } from "next/navigation";

import { VehicleForm } from "@/components/vehicle-form";
import { PageHeader } from "@/components/ui";
import { updateVehicleAction } from "@/lib/actions/vehicles";
import { vehicleTitle } from "@/lib/part-logic";
import { eligibleParents } from "@/lib/fleet";
import { getVehicle, listVehicles } from "@/lib/queries";

export default async function EditVehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const fleet = await listVehicles(true);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow={vehicleTitle(vehicle)} title="Edit vehicle" />
      <VehicleForm
        action={updateVehicleAction}
        vehicle={vehicle}
        parentOptions={eligibleParents(fleet, vehicle.id)}
        cancelHref={`/vehicles/${vehicle.id}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
