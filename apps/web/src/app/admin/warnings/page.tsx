import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageIntro } from "@/components/layout/page-intro";
import { AddToOrderButton } from "@/features/orders/add-to-order-button";
import { requireUser } from "@/server/auth";
import { formatQuantity } from "@/server/format";
import { getWarnings } from "@/server/warnings";

export default async function WarningsPage() {
  const user = await requireUser();
  const locationIds = user.role === "MASTER_ADMIN" ? undefined : user.assignedLocationIds;
  const warnings = await getWarnings(locationIds);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Warnungen"
        description="Low-Stock- und Aging-Warnungen werden bevorzugt aus den aktuellen Bewegungs- und Bestandsdaten berechnet."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low Stock</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Bestand</TableHead>
                  <TableHead>Mindestbestand</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warnings.lowStock.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.article.name}</TableCell>
                    <TableCell>{entry.location.name}</TableCell>
                    <TableCell>{formatQuantity(entry.quantity)}</TableCell>
                    <TableCell>{formatQuantity(entry.article.minimumStock)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <AddToOrderButton
                          locationId={entry.locationId}
                          articleIds={[entry.articleId]}
                          label="Zur Bestellung"
                          redirectToOrders
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aging</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Bestand</TableHead>
                  <TableHead>Schwellwert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warnings.aging.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.article.name}</TableCell>
                    <TableCell>{entry.location.name}</TableCell>
                    <TableCell>{formatQuantity(entry.quantity)}</TableCell>
                    <TableCell>{entry.location.settings?.agingWarningDays ?? 30} Tage</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
