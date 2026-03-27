import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { clearKioskSession, getKioskContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";
import { kioskResetSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const kiosk = await getKioskContext();

    if (!kiosk) {
      return apiError(new Error("Kein aktiver Kiosk gefunden."), 401);
    }

    const body = kioskResetSchema.parse(await request.json());
    const location = await prisma.location.findUnique({
      where: {
        id: kiosk.locationId
      }
    });

    if (!location) {
      throw new Error("Standort wurde nicht gefunden.");
    }

    const pinMatches = await bcrypt.compare(body.pin, location.kioskPinHash);

    if (!pinMatches) {
      throw new Error("PIN ist ungueltig.");
    }

    await clearKioskSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, 401);
  }
}
