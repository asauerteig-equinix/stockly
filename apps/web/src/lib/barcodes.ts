export function normalizeBarcode(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function dedupeBarcodes(values: Iterable<string>) {
  const uniqueBarcodes: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeBarcode(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueBarcodes.push(normalized);
  }

  return uniqueBarcodes;
}

export function sanitizeAdditionalBarcodes(values: Iterable<string>, primaryBarcode: string) {
  const normalizedPrimaryBarcode = normalizeBarcode(primaryBarcode);

  return dedupeBarcodes(values).filter((barcode) => barcode !== normalizedPrimaryBarcode);
}

export function parseBarcodeListInput(input?: string | null) {
  if (!input) {
    return [];
  }

  return dedupeBarcodes(input.split(/[\r\n,;]+/));
}

export function formatBarcodeListInput(values?: Iterable<string> | null) {
  if (!values) {
    return "";
  }

  return dedupeBarcodes(values).join("\n");
}
