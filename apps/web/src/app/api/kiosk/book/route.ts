import { MovementType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getKioskContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { recordStockMovement } from "@/server/inventory";
import { apiError } from "@/server/permissions";
import { kioskBookingSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const kiosk = await getKioskContext();

    if (!kiosk) {
      return apiError(new Error("Kiosk ist nicht gekoppelt."), 401);
    }

    const body = kioskBookingSchema.parse(await request.json());

    if (body.action === "TAKE" && !body.usageReason) {
      throw new Error("Bitte einen Entnahmegrund waehlen.");
    }

    const result = await recordStockMovement({
      locationId: kiosk.locationId,
      articleId: body.articleId,
      type: body.action === "TAKE" ? MovementType.TAKE : MovementType.RETURN,
      quantity: body.quantity,
      sourceType: SourceType.KIOSK,
      usageReason: body.action === "TAKE" ? body.usageReason : null,
      note: body.note
    });

    await prisma.kioskDevice.update({
      where: {
        id: kiosk.deviceId
      },
      data: {
        lastUsedAt: new Date()
      }
    });

    return NextResponse.json({
      movement: result.movement,
      balance: result.balance
    });
  } catch (error) {
    return apiError(error);
  }
}
