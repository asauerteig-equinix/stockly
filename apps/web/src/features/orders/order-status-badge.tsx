import { Badge } from "@/components/ui/badge";
import { getOrderStatusLabel, getOrderStatusVariant, type OrderStatus } from "@/features/orders/order-utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={getOrderStatusVariant(status)}>{getOrderStatusLabel(status)}</Badge>;
}
