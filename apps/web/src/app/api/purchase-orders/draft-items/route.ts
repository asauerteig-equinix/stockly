import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { upsertDraftOrderItems } from "@/server/orders";
import { assertLocationAccess, apiError } from "@/server/permissions";
import { purchaseOrderDraftItemsSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const body = purchaseOrderDraftItemsSchema.parse(await request.json());
    assertLocationAccess(user, body.locationId);

    const order = await upsertDraftOrderItems({
      locationId: body.locationId,
      articleIds: body.articleIds,
      userId: user.id
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id
    });
  } catch (error) {
    return apiError(error);
  }
}
