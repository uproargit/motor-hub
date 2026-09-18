import { notFound } from "next/navigation";

import { PartForm } from "@/components/part-form";
import { PageHeader } from "@/components/ui";
import { updatePartAction } from "@/lib/actions/parts";
import { getPart, getVehicle } from "@/lib/queries";

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ vehicleId: string; partId: string }>;
}) {
  const { vehicleId, partId } = await params;
  const [vehicle, part] = await Promise.all([getVehicle(vehicleId), getPart(partId)]);
  if (!vehicle || !part || part.vehicle_id !== vehicle.id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Edit part" title={part.name} />
      <PartForm
        action={updatePartAction}
        vehicle={vehicle}
        part={part}
        mode="edit"
        cancelHref={`/vehicles/${vehicle.id}/parts/${part.id}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
