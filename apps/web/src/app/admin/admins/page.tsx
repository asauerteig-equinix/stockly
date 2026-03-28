import { Card, CardContent } from "@/components/ui/card";
import { PageIntro } from "@/components/layout/page-intro";
import { AdminManagement } from "@/features/admin/admin-management";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function AdminsPage() {
  const user = await requireUser();

  if (user.role !== "MASTER_ADMIN") {
    return (
      <div className="space-y-8">
        <PageIntro
          title="Adminverwaltung"
          description="Nutzerkonten und globale Rollen koennen nur durch Master Admins verwaltet werden."
        />
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            Sie sehen diese Seite nur informativ. Nur ein Master Admin darf neue Nutzer anlegen oder globale Rollen
            vergeben.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [users, locations] = await Promise.all([
    prisma.user.findMany({
      include: {
        assignedLocations: {
          include: {
            location: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    prisma.location.findMany({
      orderBy: {
        name: "asc"
      }
    })
  ]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Adminverwaltung"
        description="Nutzer anlegen, Rollen setzen und Standortzugriffe steuern."
      />

      <AdminManagement
        canManage
        users={users.map((entry) => ({
          id: entry.id,
          name: entry.name,
          email: entry.email,
          role: entry.role,
          assignedLocations: entry.assignedLocations.map((assignment) => assignment.location.name)
        }))}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name
        }))}
      />
    </div>
  );
}
