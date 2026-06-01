import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import {
  processReceipt,
  recomputeRequestTotal,
  type ReceiptJobContext,
} from "@/lib/jobs/process-receipt";
import type { ReceiptParseMessage } from "@/lib/queue";

/**
 * Standalone Cloudflare Queue consumer Worker for receipt parsing.
 *
 * It runs OUTSIDE the OpenNext request context, so it injects db / R2 bucket /
 * Gemini config explicitly into the receipt job (which otherwise resolves them
 * from getCloudflareContext()). Deployed separately via wrangler.consumer.jsonc;
 * it shares the `receipt-parse` queue with the app Worker's producer.
 *
 * NOTE: not exercised by the local test suite — verify on deploy.
 */
type Env = {
  DB: D1Database;
  RECEIPTS_BUCKET: R2Bucket;
  GOOGLE_AI_API_KEY: string;
  GOOGLE_AI_MODEL?: string;
};

const handler = {
  async queue(
    batch: MessageBatch<ReceiptParseMessage>,
    env: Env
  ): Promise<void> {
    const ctx: ReceiptJobContext = {
      db: drizzle(env.DB, { schema }),
      bucket: env.RECEIPTS_BUCKET,
      aiApiKey: env.GOOGLE_AI_API_KEY,
      aiModel: env.GOOGLE_AI_MODEL,
    };

    // Track each request's messages so ack/retry can be decided AFTER the
    // recompute step — otherwise a recompute failure on an already-ack'd message
    // would silently strand a stale (often $0) requestedTotal with no retry.
    const messagesByRequest = new Map<
      string,
      Array<Message<ReceiptParseMessage>>
    >();
    for (const message of batch.messages) {
      try {
        await processReceipt(message.body.receiptFileId, ctx);
        const { requestId } = message.body;
        const group = messagesByRequest.get(requestId) ?? [];
        group.push(message);
        messagesByRequest.set(requestId, group);
      } catch (error) {
        console.error("[queue] receipt parse failed", message.body, error);
        message.retry();
      }
    }

    // Recompute each affected request's total once per batch. Only ack the
    // request's messages once its recompute succeeds; on failure, retry them so
    // the total is reconciled on redelivery instead of being lost.
    for (const [requestId, messages] of messagesByRequest) {
      try {
        await recomputeRequestTotal(requestId, ctx);
        for (const message of messages) {
          message.ack();
        }
      } catch (error) {
        console.error("[queue] total recompute failed", requestId, error);
        for (const message of messages) {
          message.retry();
        }
      }
    }
  },
} satisfies ExportedHandler<Env, ReceiptParseMessage>;

export default handler;
