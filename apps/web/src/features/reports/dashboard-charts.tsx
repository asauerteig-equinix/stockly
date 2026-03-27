"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardChartsProps = {
  consumptionSeries: Array<{ label: string; quantity: number }>;
  usageReasonDistribution: Array<{ usageReason: string; count: number }>;
};

const pieColors = ["#0284c7", "#0f766e", "#ea580c", "#b45309", "#64748b"];

export function DashboardCharts({ consumptionSeries, usageReasonDistribution }: DashboardChartsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Verbrauch der letzten 30 Tage</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={consumptionSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="quantity" fill="#0284c7" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verwendungszwecke</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={usageReasonDistribution} dataKey="count" nameKey="usageReason" innerRadius={64} outerRadius={96}>
                {usageReasonDistribution.map((entry, index) => (
                  <Cell key={entry.usageReason} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
