import { VehicleForm } from "@/components/vehicle-form";
import { PageHeader } from "@/components/ui";
import { createVehicleAction } from "@/lib/actions/vehicles";

export default function NewVehiclePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="New"
        title="Add a vehicle"
        description="Car, truck, UTV, boat or equipment — anything you want a build sheet and service record for."
      />
      <VehicleForm action={createVehicleAction} vehicle={null} cancelHref="/vehicles" submitLabel="Add vehicle" />
    </div>
  );
}
