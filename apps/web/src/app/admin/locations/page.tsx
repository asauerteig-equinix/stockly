import { PageIntro } from "@/components/layout/page-intro";
import { LocationManagement } from "@/features/admin/location-management";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function LocationsPage() {
  const user = await requireUser();
  const locations = await prisma.location.findMany({
    where:
      user.role === "MASTER_ADMIN"
        ? undefined
        : {
            id: {
              in: user.assignedLocationIds
            }
          },
    include: {
      settings: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return (
    <div className="space-y-8">
      <PageIntro
        title="Standortverwaltung"
        description="Standorte, PINs und Lagerregeln zentral pflegen."
      />

      <LocationManagement
        canManage={user.role === "MASTER_ADMIN"}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          code: location.code,
          description: location.description,
          isActive: location.isActive,
          agingWarningDays: location.settings?.agingWarningDays ?? 30,
          allowNegativeStock: location.settings?.allowNegativeStock ?? false
        }))}
      />
    </div>
  );
}
