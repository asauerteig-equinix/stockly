import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { apiError } from "@/server/permissions";
import { getWarnings } from "@/server/warnings";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const warnings = await getWarnings(user.role === "MASTER_ADMIN" ? undefined : user.assignedLocationIds);
    return NextResponse.json(warnings);
  } catch (error) {
    return apiError(error);
  }
}
