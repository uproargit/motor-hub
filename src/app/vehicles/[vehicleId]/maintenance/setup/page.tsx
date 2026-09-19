import Link from "next/link";
import { notFound } from "next/navigation";

import { StarterSchedulesForm } from "@/components/starter-schedules-form";
import { Card, PageHeader } from "@/components/ui";
import { VEHICLE_TYPES } from "@/lib/domain";
import { getVehicle } from "@/lib/queries";
import { starterSchedulesFor } from "@/lib/starter-schedules";

export default async function StarterSchedulesPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound();

  const presets = starterSchedulesFor(vehicle);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Maintenance"
        title="Start from a factory schedule"
        description={`Common intervals for a ${VEHICLE_TYPES[vehicle.vehicle_type].label.toLowerCase()}. These are generic figures, not the manufacturer's published schedule — edit them against your owner's manual.`}
      />

      <Card className="p-5">
        <p className="mb-4 text-sm text-muted">
          Each one you keep becomes a maintenance item with its own interval. They stay off the build
          sheet, and intervals count from today&rsquo;s readings.
        </p>
        <StarterSchedulesForm vehicle={vehicle} presets={presets} />
      </Card>

      <p className="text-sm text-muted">
        <Link href={`/vehicles/${vehicle.id}/maintenance`} className="underline">
          Back to maintenance
        </Link>
      </p>
    </div>
  );
}
