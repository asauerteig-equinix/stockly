import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageIntro } from "@/components/layout/page-intro";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatDateTime, formatQuantity } from "@/server/format";

export default async function MovementHistoryPage() {
  const user = await requireUser();
  const movements = await prisma.stockMovement.findMany({
    where:
      user.role === "MASTER_ADMIN"
        ? undefined
        : {
            locationId: {
              in: user.assignedLocationIds
            }
          },
    include: {
      article: true,
      location: true,
      createdByUser: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return (
    <div className="space-y-8">
      <PageIntro
        title="Bewegungshistorie"
        description="Alle letzten Lagerbewegungen mit Quelle, Standortbezug und zeitlicher Nachvollziehbarkeit."
      />

      <Card>
        <CardHeader>
          <CardTitle>Letzte 50 Bewegungen</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Menge</TableHead>
                <TableHead>Quelle</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                  <TableCell>{movement.article.name}</TableCell>
                  <TableCell>{movement.location.name}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell>{formatQuantity(movement.quantity)}</TableCell>
                  <TableCell>{movement.sourceType}</TableCell>
                  <TableCell>{movement.usageReason ?? "—"}</TableCell>
                  <TableCell>{movement.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
