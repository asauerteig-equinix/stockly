import { MovementType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { recordStockMovement } from "@/server/inventory";
import { assertLocationAccess, apiError } from "@/server/permissions";
import { goodsReceiptSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const body = goodsReceiptSchema.parse(await request.json());
    assertLocationAccess(user, body.locationId);

    const result = await recordStockMovement({
      locationId: body.locationId,
      articleId: body.articleId,
      type: MovementType.GOODS_RECEIPT,
      quantity: body.quantity,
      sourceType: SourceType.ADMIN,
      note: body.note,
      createdByUserId: user.id
    });

    return NextResponse.json({ result });
  } catch (error) {
    return apiError(error);
  }
}
