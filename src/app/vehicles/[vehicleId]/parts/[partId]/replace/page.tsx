import { notFound } from "next/navigation";

import { PartForm } from "@/components/part-form";
import { PageHeader } from "@/components/ui";
import { replacePartAction } from "@/lib/actions/parts";
import { getPart, getVehicle } from "@/lib/queries";

/**
 * Replacing a part creates a new record and closes out the old one, so both
 * stay on the vehicle's permanent history.
 */
export default async function ReplacePartPage({
  params,
}: {
  params: Promise<{ vehicleId: string; partId: string }>;
}) {
  const { vehicleId, partId } = await params;
  const vehicle = getVehicle(vehicleId);
  const outgoing = getPart(partId);
  if (!vehicle || !outgoing || outgoing.vehicle_id !== vehicle.id) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Replace part"
        title={`Replacing ${outgoing.name}`}
        description="The old part is kept with its full history and marked as replaced."
      />
      <PartForm
        action={replacePartAction}
        vehicle={vehicle}
        part={null}
        mode="replace"
        outgoingPart={outgoing}
        cancelHref={`/vehicles/${vehicle.id}/parts/${outgoing.id}`}
        submitLabel="Record replacement"
      />
    </div>
  );
}
