import { notFound } from "next/navigation";

import { VehicleForm } from "@/components/vehicle-form";
import { PageHeader } from "@/components/ui";
import { updateVehicleAction } from "@/lib/actions/vehicles";
import { vehicleTitle } from "@/lib/part-logic";
import { getVehicle } from "@/lib/queries";

export default async function EditVehiclePage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow={vehicleTitle(vehicle)} title="Edit vehicle" />
      <VehicleForm
        action={updateVehicleAction}
        vehicle={vehicle}
        cancelHref={`/vehicles/${vehicle.id}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
