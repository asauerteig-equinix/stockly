import { z } from "zod";

import { usageReasonOptions } from "@/server/constants";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const locationSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(12).regex(/^[A-Z0-9_-]+$/),
  description: z.string().max(300).optional().nullable(),
  kioskPin: z.string().min(4).max(20),
  agingWarningDays: z.coerce.number().int().min(1).max(365),
  allowNegativeStock: z.coerce.boolean().optional().default(false)
});

export const articleSchema = z.object({
  id: z.string().optional(),
  locationId: z.string().min(1),
  name: z.string().min(2),
  barcode: z.string().min(3),
  description: z.string().max(500).optional().nullable(),
  manufacturerNumber: z.string().max(120).optional().nullable(),
  supplierNumber: z.string().max(120).optional().nullable(),
  category: z.string().min(2),
  minimumStock: z.coerce.number().int().min(0),
  isArchived: z.coerce.boolean().optional().default(false)
});

export const goodsReceiptSchema = z.object({
  articleId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  note: z.string().max(300).optional().nullable()
});

export const correctionSchema = z.object({
  articleId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.coerce.number().int().refine((value) => value !== 0, {
    message: "Korrekturmenge darf nicht 0 sein."
  }),
  note: z.string().min(3).max(300)
});

export const kioskRegisterSchema = z.object({
  locationId: z.string().min(1),
  pin: z.string().min(4),
  label: z.string().min(2).max(80).default("Lagerterminal")
});

export const kioskBookingSchema = z.object({
  articleId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  action: z.enum(["TAKE", "RETURN"]),
  usageReason: z.enum(usageReasonOptions).optional().nullable(),
  note: z.string().max(300).optional().nullable()
});

export const kioskLookupSchema = z.object({
  barcode: z.string().min(3)
});

export const kioskResetSchema = z.object({
  pin: z.string().min(4)
});

export const createAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["MASTER_ADMIN", "ADMIN"]).default("ADMIN"),
  locationIds: z.array(z.string()).default([])
});
