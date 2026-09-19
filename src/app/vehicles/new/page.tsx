import { VehicleForm } from "@/components/vehicle-form";
import { PageHeader } from "@/components/ui";
import { createVehicleAction } from "@/lib/actions/vehicles";
import { eligibleParents } from "@/lib/fleet";
import { listVehicles } from "@/lib/queries";

export default async function NewVehiclePage() {
  const fleet = await listVehicles();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="New"
        title="Add a vehicle"
        description="Car, truck, UTV, boat or equipment — anything you want a build sheet and service record for."
      />
      <VehicleForm
        action={createVehicleAction}
        vehicle={null}
        parentOptions={eligibleParents(fleet, null)}
        cancelHref="/vehicles"
        submitLabel="Add vehicle"
      />
    </div>
  );
}
