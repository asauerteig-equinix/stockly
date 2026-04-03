import { prisma } from "@/server/db";

function pad(num: number) {
  return num.toString().padStart(4, "0");
}

export async function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  const dd = `${now.getDate()}`.padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `PO-${datePart}-`;

  const latestOrder = await prisma.purchaseOrder.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      orderNumber: "desc"
    },
    select: {
      orderNumber: true
    }
  });

  const latestSequence = latestOrder ? Number.parseInt(latestOrder.orderNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${pad(latestSequence + 1)}`;
}
