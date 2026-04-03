export type OrderStatus = "DRAFT" | "ORDERED";

export function getOrderStatusLabel(status: OrderStatus) {
  return status === "DRAFT" ? "Entwurf" : "Bestellt";
}

export function getOrderStatusVariant(status: OrderStatus) {
  return status === "DRAFT" ? "muted" : "success";
}
