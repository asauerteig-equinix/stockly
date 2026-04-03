import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { submitPurchaseOrder } from "@/server/orders";
import { assertLocationAccess, apiError } from "@/server/permissions";
import { purchaseOrderSubmitSchema } from "@/server/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { id } = await params;
    const order = await prisma.purchaseOrder.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        locationId: true
      }
    });

    if (!order) {
      throw new Error("Bestellung nicht gefunden.");
    }

    assertLocationAccess(user, order.locationId);

    const body = purchaseOrderSubmitSchema.parse(await request.json());
    await submitPurchaseOrder({
      orderId: id,
      userId: user.id,
      note: body.note ?? null
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
