import { env } from "@/lib/env";

export async function enqueueReceiptParseJob(receiptFileId: string) {
  await fetch(`${env.APP_URL}/api/jobs/parse-receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptFileId }),
  });
}
