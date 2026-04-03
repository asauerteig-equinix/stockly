const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

export function formatCurrency(cents: number | null | undefined, fallback = "Keine Angabe") {
  if (cents === null || cents === undefined) {
    return fallback;
  }

  return euroFormatter.format(cents / 100);
}

export function formatCurrencyInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) {
    return "";
  }

  return (cents / 100).toFixed(2);
}

export function parseCurrencyInputToCents(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Preis muss eine Zahl ab 0 sein.");
    }

    return Math.round(value * 100);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\s+/g, "").replace(/[€]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Preis muss eine Zahl ab 0 sein.");
  }

  return Math.round(parsed * 100);
}
