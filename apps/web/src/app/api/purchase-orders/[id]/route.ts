import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { deletePurchaseOrder } from "@/server/orders";
import { assertLocationAccess, apiError } from "@/server/permissions";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
      return apiError(new Error("Bestellung nicht gefunden."), 404);
    }

    assertLocationAccess(user, order.locationId);
    await deletePurchaseOrder({
      orderId: id
    });

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return apiError(error);
  }
}
