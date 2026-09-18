import { notFound } from "next/navigation";

import { PartForm } from "@/components/part-form";
import { PageHeader } from "@/components/ui";
import { createPartAction } from "@/lib/actions/parts";
import { vehicleTitle } from "@/lib/part-logic";
import { getVehicle } from "@/lib/queries";

export default async function NewPartPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={vehicleTitle(vehicle)}
        title="Add a part or modification"
        description="Only the name is required — fill in as much of the rest as you have."
      />
      <PartForm
        action={createPartAction}
        vehicle={vehicle}
        part={null}
        mode="create"
        cancelHref={`/vehicles/${vehicle.id}/parts`}
        submitLabel="Save part"
      />
    </div>
  );
}
