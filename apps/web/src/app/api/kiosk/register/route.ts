import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createKioskSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";
import { kioskRegisterSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const body = kioskRegisterSchema.parse(await request.json());
    const location = await prisma.location.findUnique({
      where: {
        id: body.locationId
      }
    });

    if (!location || !location.isActive) {
      throw new Error("Standort wurde nicht gefunden.");
    }

    const pinMatches = await bcrypt.compare(body.pin, location.kioskPinHash);

    if (!pinMatches) {
      throw new Error("PIN ist ungueltig.");
    }

    const device = await createKioskSession(location.id, body.label);

    return NextResponse.json({
      success: true,
      device
    });
  } catch (error) {
    return apiError(error, 401);
  }
}
