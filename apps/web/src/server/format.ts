import { format } from "date-fns";
import { de } from "date-fns/locale";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Keine Angabe";
  }

  return format(new Date(value), "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Keine Angabe";
  }

  return format(new Date(value), "dd.MM.yyyy", { locale: de });
}

export function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("de-DE").format(quantity);
}
