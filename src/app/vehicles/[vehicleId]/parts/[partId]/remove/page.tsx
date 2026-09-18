import Link from "next/link";
import { notFound } from "next/navigation";

import { RemovePartForm } from "@/components/part-actions";
import { Card, PageHeader } from "@/components/ui";
import { getPart, getVehicle } from "@/lib/queries";

export default async function RemovePartPage({
  params,
}: {
  params: Promise<{ vehicleId: string; partId: string }>;
}) {
  const { vehicleId, partId } = await params;
  const [vehicle, part] = await Promise.all([getVehicle(vehicleId), getPart(partId)]);
  if (!vehicle || !part || part.vehicle_id !== vehicle.id) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Remove part"
        title={part.name}
        description="Record when and why it came off. Nothing is deleted."
        actions={
          <Link href={`/vehicles/${vehicle.id}/parts/${part.id}/replace`} className="btn-secondary">
            Replacing it instead?
          </Link>
        }
      />
      <Card className="p-5">
        <RemovePartForm part={part} vehicle={vehicle} />
      </Card>
    </div>
  );
}
