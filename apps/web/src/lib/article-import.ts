import * as XLSX from "xlsx";
import { z } from "zod";

export { articleImportTemplateHeaders } from "@/lib/article-import-template";

type ArticleImportColumn =
  | "locationCode"
  | "locationName"
  | "categoryName"
  | "sortOrder"
  | "name"
  | "barcode"
  | "additionalBarcodes"
  | "description"
  | "manufacturerNumber"
  | "supplierNumber"
  | "minimumStock"
  | "active"
  | "imageUrl";

const articleImportColumnAliases: Record<ArticleImportColumn, string[]> = {
  locationCode: ["Standort Code", "Location Code", "Lager Code", "locationCode"],
  locationName: ["Standort", "Location", "Lager", "locationName"],
  categoryName: ["Kategorie", "Category", "categoryName"],
  sortOrder: ["Reihenfolge", "Sortierung", "Sort Order", "sortOrder"],
  name: ["Artikelname", "Artikel", "Name", "Article Name", "articleName"],
  barcode: ["Barcode", "Hauptbarcode", "EAN"],
  additionalBarcodes: ["Weitere Barcodes", "Zusatzbarcodes", "Additional Barcodes", "additionalBarcodes"],
  description: ["Beschreibung", "Description", "description"],
  manufacturerNumber: ["Herstellernummer", "Manufacturer Number", "manufacturerNumber"],
  supplierNumber: ["Lieferantennummer", "Supplier Number", "supplierNumber"],
  minimumStock: ["Mindestbestand", "Minimum Stock", "minimumStock"],
  active: ["Aktiv", "Active", "active"],
  imageUrl: ["Bild URL", "Image URL", "imageUrl"]
};

const requiredColumns: ArticleImportColumn[] = ["categoryName", "name", "barcode"];

const articleImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  locationCode: z.string().max(40).optional(),
  locationName: z.string().max(160).optional(),
  categoryName: z.string().min(2).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  name: z.string().min(2).max(200),
  barcode: z.string().min(3).max(160),
  additionalBarcodes: z.array(z.string().min(3).max(160)).default([]),
  description: z.string().max(500).optional(),
  manufacturerNumber: z.string().max(120).optional(),
  supplierNumber: z.string().max(120).optional(),
  minimumStock: z.number().int().min(0).max(999999).optional(),
  active: z.boolean().optional(),
  imageUrl: z.string().max(500).optional()
});

export type ParsedArticleImportRow = z.infer<typeof articleImportRowSchema>;

export type ParsedArticleImportFile = {
  rows: ParsedArticleImportRow[];
  presentColumns: Set<ArticleImportColumn>;
  unknownHeaders: string[];
  sheetName: string;
};

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeTextCell(value: unknown) {
  return String(value ?? "").trim();
}

function getMappedColumn(header: string) {
  const normalizedHeader = normalizeLookupValue(header);

  for (const [column, aliases] of Object.entries(articleImportColumnAliases) as [ArticleImportColumn, string[]][]) {
    if (aliases.some((alias) => normalizeLookupValue(alias) === normalizedHeader)) {
      return column;
    }
  }

  return null;
}

function parseIntegerCell(value: string, rowNumber: number, label: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Zeile ${rowNumber}: ${label} muss eine ganze Zahl ab 0 sein.`);
  }

  return parsed;
}

function parseBooleanCell(value: string, rowNumber: number) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = normalizeLookupValue(value);

  if (["1", "true", "ja", "yes", "y", "aktiv"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "nein", "no", "n", "inaktiv"].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`Zeile ${rowNumber}: Aktiv erwartet z. B. ja/nein, true/false oder 1/0.`);
}

function parseBarcodeListCell(value: string) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[\n,;|]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function getColumnValue(row: Partial<Record<ArticleImportColumn, string>>, column: ArticleImportColumn) {
  return row[column] ?? "";
}

export function normalizeArticleImportLookup(value: string) {
  return normalizeLookupValue(value);
}

export async function parseArticleImportFile(file: File): Promise<ParsedArticleImportFile> {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Die Datei enthaelt kein Tabellenblatt.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawHeaderRows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false
  });
  const rawHeaders = rawHeaderRows[0]?.map((cell) => normalizeTextCell(cell)).filter(Boolean) ?? [];

  if (rawHeaders.length === 0) {
    throw new Error("Die Datei enthaelt keine Kopfzeile.");
  }

  const headerMap = new Map<string, ArticleImportColumn>();
  const presentColumns = new Set<ArticleImportColumn>();
  const unknownHeaders: string[] = [];

  for (const header of rawHeaders) {
    const mappedColumn = getMappedColumn(header);

    if (mappedColumn) {
      headerMap.set(header, mappedColumn);
      presentColumns.add(mappedColumn);
    } else {
      unknownHeaders.push(header);
    }
  }

  const missingColumns = requiredColumns.filter((column) => !presentColumns.has(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `Pflichtspalten fehlen: ${missingColumns
        .map((column) => articleImportColumnAliases[column][0])
        .join(", ")}.`
    );
  }

  if (!presentColumns.has("locationCode") && !presentColumns.has("locationName")) {
    throw new Error("Pflichtspalte fehlt: Standort Code oder Standort.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });

  const rows: ParsedArticleImportRow[] = [];

  for (const [index, rawRow] of rawRows.entries()) {
    const rowNumber = index + 2;
    const normalizedRow: Partial<Record<ArticleImportColumn, string>> = {};

    for (const [header, value] of Object.entries(rawRow)) {
      const mappedColumn = headerMap.get(header);
      if (mappedColumn) {
        normalizedRow[mappedColumn] = normalizeTextCell(value);
      }
    }

    const isEmptyRow = Object.values(normalizedRow).every((value) => !value);
    if (isEmptyRow) {
      continue;
    }

    const locationCode = presentColumns.has("locationCode") ? getColumnValue(normalizedRow, "locationCode") : undefined;
    const locationName = presentColumns.has("locationName") ? getColumnValue(normalizedRow, "locationName") : undefined;

    if (!locationCode && !locationName) {
      throw new Error(`Zeile ${rowNumber}: Standort Code oder Standort muss angegeben werden.`);
    }

    const parsedRow = articleImportRowSchema.parse({
      rowNumber,
      locationCode,
      locationName,
      categoryName: getColumnValue(normalizedRow, "categoryName"),
      sortOrder: presentColumns.has("sortOrder")
        ? parseIntegerCell(getColumnValue(normalizedRow, "sortOrder"), rowNumber, "Reihenfolge")
        : undefined,
      name: getColumnValue(normalizedRow, "name"),
      barcode: getColumnValue(normalizedRow, "barcode"),
      additionalBarcodes: presentColumns.has("additionalBarcodes")
        ? parseBarcodeListCell(getColumnValue(normalizedRow, "additionalBarcodes"))
        : [],
      description: presentColumns.has("description") ? getColumnValue(normalizedRow, "description") : undefined,
      manufacturerNumber: presentColumns.has("manufacturerNumber")
        ? getColumnValue(normalizedRow, "manufacturerNumber")
        : undefined,
      supplierNumber: presentColumns.has("supplierNumber") ? getColumnValue(normalizedRow, "supplierNumber") : undefined,
      minimumStock: presentColumns.has("minimumStock")
        ? parseIntegerCell(getColumnValue(normalizedRow, "minimumStock"), rowNumber, "Mindestbestand")
        : undefined,
      active: presentColumns.has("active")
        ? parseBooleanCell(getColumnValue(normalizedRow, "active"), rowNumber)
        : undefined,
      imageUrl: presentColumns.has("imageUrl") ? getColumnValue(normalizedRow, "imageUrl") : undefined
    });

    rows.push(parsedRow);
  }

  if (rows.length === 0) {
    throw new Error("Die Datei enthaelt keine importierbaren Datenzeilen.");
  }

  return {
    rows,
    presentColumns,
    unknownHeaders,
    sheetName: firstSheetName
  };
}
