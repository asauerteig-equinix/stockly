import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { removePurchaseOrderItem, updatePurchaseOrderItemQuantity } from "@/server/orders";
import { assertLocationAccess, apiError } from "@/server/permissions";
import { purchaseOrderItemUpdateSchema } from "@/server/validation";

async function getVisibleOrder(orderId: string) {
  const order = await prisma.purchaseOrder.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      locationId: true
    }
  });

  if (!order) {
    throw new Error("Bestellung nicht gefunden.");
  }

  return order;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { id, itemId } = await params;
    const order = await getVisibleOrder(id);
    assertLocationAccess(user, order.locationId);

    const body = purchaseOrderItemUpdateSchema.parse(await request.json());
    await updatePurchaseOrderItemQuantity({
      orderId: id,
      itemId,
      quantity: body.quantity,
      userId: user.id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { id, itemId } = await params;
    const order = await getVisibleOrder(id);
    assertLocationAccess(user, order.locationId);

    const result = await removePurchaseOrderItem({
      orderId: id,
      itemId,
      userId: user.id
    });

    return NextResponse.json({
      ok: true,
      deletedOrderId: result.deletedOrderId
    });
  } catch (error) {
    return apiError(error);
  }
}
