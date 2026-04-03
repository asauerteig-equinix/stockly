import { getCurrentUser } from "@/server/auth";
import { buildPurchaseOrderPdf, getPurchaseOrderForUser } from "@/server/order-documents";
import { apiError } from "@/server/permissions";

function buildPdfFileName(orderNumber: string) {
  return `${orderNumber.replace(/[^a-zA-Z0-9._-]+/g, "-")}.pdf`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { id } = await params;
    const order = await getPurchaseOrderForUser(id, user);

    if (!order) {
      return apiError(new Error("Bestellung nicht gefunden."), 404);
    }

    const pdfBytes = await buildPurchaseOrderPdf(order);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${buildPdfFileName(order.orderNumber)}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
