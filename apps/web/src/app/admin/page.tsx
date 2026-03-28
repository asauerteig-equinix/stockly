import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageIntro } from "@/components/layout/page-intro";
import { DashboardCharts } from "@/features/reports/dashboard-charts";
import { requireUser } from "@/server/auth";
import { formatDateTime, formatQuantity } from "@/server/format";
import { getDashboardReport } from "@/server/reports";
import { getWarnings } from "@/server/warnings";

function statCards(stats: Array<{ label: string; value: string; hint: string }>) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
            <p className="text-sm text-slate-600">{stat.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireUser();
  const locationIds = user.role === "MASTER_ADMIN" ? undefined : user.assignedLocationIds;
  const report = await getDashboardReport(locationIds);
  const warnings = await getWarnings(locationIds);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Dashboard"
        description="Schnelle Uebersicht ueber Bestand, Warnungen, Verbrauch und die letzten Lagerbewegungen."
      />

      {statCards([
        {
          label: "Artikel im Bestand",
          value: formatQuantity(report.totals.articles),
          hint: "Aktuell gefuehrte Artikel ueber alle sichtbaren Standorte."
        },
        {
          label: "Gesamtbestand",
          value: formatQuantity(report.totals.quantity),
          hint: "Summierter Lagerbestand aus den aktuellen Balance-Eintraegen."
        },
        {
          label: "Warnungen",
          value: formatQuantity(warnings.lowStock.length + warnings.aging.length),
          hint: "Low-Stock- und Aging-Hinweise fuer den operativen Alltag."
        }
      ])}

      <DashboardCharts
        consumptionSeries={report.consumptionSeries}
        usageReasonDistribution={report.usageReasonDistribution}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meist entnommene Artikel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.topWithdrawals.length ? (
                report.topWithdrawals.map((entry) => (
                  <div key={entry.articleId} className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
                    <span className="font-medium text-slate-900">{entry.articleName}</span>
                    <span className="text-sm text-slate-600">{formatQuantity(entry.quantity)} Stueck</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Noch keine Entnahmen im ausgewaehlten Zeitraum.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Artikel ohne Bewegung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.dormantArticles.length ? (
                report.dormantArticles.map((article) => (
                  <div key={article.id} className="rounded-xl border border-border bg-white/80 px-4 py-3">
                    <p className="font-medium text-slate-900">{article.name}</p>
                    <p className="text-sm text-slate-500">
                      {article.location.name} • Bestand {formatQuantity(article.inventoryBalance?.quantity ?? 0)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Alle sichtbaren Artikel haben bereits Bewegungen.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Bewegungen</CardTitle>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.recentMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                  <TableCell>{movement.article.name}</TableCell>
                  <TableCell>{movement.location.name}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell>{formatQuantity(movement.quantity)}</TableCell>
                  <TableCell>{movement.sourceType}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
