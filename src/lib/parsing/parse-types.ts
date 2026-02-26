import { z } from "zod";

export const normalizedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  lineTotal: z.number().nullable(),
  category: z.string().nullable(),
});

export const normalizedReceiptSchema = z.object({
  documentType: z.enum(["RECEIPT", "INVOICE", "W9", "CHECK_REQUEST_FORM", "OTHER"]),
  merchant: z.string().nullable(),
  receiptDate: z.string().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  currency: z.string().default("USD"),
  confidence: z.number().min(0).max(1).default(0.5),
  flags: z.array(z.string()).default([]),
  lineItems: z.array(normalizedLineItemSchema).default([]),
  raw: z.record(z.string(), z.unknown()).default({}),
});

export type NormalizedReceipt = z.infer<typeof normalizedReceiptSchema>;
export type NormalizedLineItem = z.infer<typeof normalizedLineItemSchema>;
