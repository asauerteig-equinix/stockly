import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { apiError } from "@/server/permissions";
import { getDashboardReport } from "@/server/reports";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const report = await getDashboardReport(user.role === "MASTER_ADMIN" ? undefined : user.assignedLocationIds);
    return NextResponse.json(report);
  } catch (error) {
    return apiError(error);
  }
}
