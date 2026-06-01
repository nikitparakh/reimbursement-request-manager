import { getCloudflareContext } from "@opennextjs/cloudflare";

export type ReceiptParseMessage = {
  receiptFileId: string;
  requestId: string;
};

/**
 * The RECEIPT_QUEUE producer binding when running on Workers; undefined in
 * plain Node contexts (tests / `next dev` without queue bindings), where the
 * caller falls back to inline processing.
 */
export function getReceiptQueue(): Queue<ReceiptParseMessage> | undefined {
  try {
    return getCloudflareContext().env.RECEIPT_QUEUE;
  } catch {
    return undefined;
  }
}
