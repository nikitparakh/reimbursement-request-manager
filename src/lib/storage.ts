import { getCloudflareContext } from "@opennextjs/cloudflare";
import { env } from "@/lib/env";

export type StoredObject = {
  key: string;
  url: string;
};

/**
 * Resolve the R2 bucket binding when running on Workers (or `next dev` with the
 * OpenNext dev bindings). Returns undefined in plain Node contexts (e.g. tests),
 * which fall back to local filesystem storage.
 */
function getReceiptsBucket(): R2Bucket | undefined {
  try {
    return getCloudflareContext().env.RECEIPTS_BUCKET;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Local filesystem helpers (dev/test fallback when no R2 binding is present)
// ---------------------------------------------------------------------------

function getUploadRoot() {
  const path = require("node:path") as typeof import("node:path");
  return path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);
}

function safeExtension(fileName: string) {
  const path = require("node:path") as typeof import("node:path");
  const rawExt = path.extname(fileName).toLowerCase();
  const normalizedExt = rawExt.replace(/[^.a-z0-9]/g, "");
  if (!normalizedExt || normalizedExt === "." || normalizedExt.length > 10) {
    return ".bin";
  }
  return normalizedExt;
}

function toAbsoluteUploadPath(key: string) {
  const path = require("node:path") as typeof import("node:path");
  const uploadRoot = getUploadRoot();
  const filePath = path.resolve(uploadRoot, key);
  const relative = path.relative(uploadRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe storage path");
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadReceiptFile(input: {
  fileName: string;
  mimeType: string;
  body: Uint8Array;
}): Promise<StoredObject> {
  const bucket = getReceiptsBucket();
  if (bucket) {
    const key = `receipts/${crypto.randomUUID()}${safeExtension(input.fileName)}`;
    await bucket.put(key, input.body, {
      httpMetadata: { contentType: input.mimeType },
    });
    return { key, url: `r2://${key}` };
  }

  const path = await import("node:path");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { pathToFileURL } = await import("node:url");

  const key = path.join("receipts", `${crypto.randomUUID()}${safeExtension(input.fileName)}`);
  const absolutePath = toAbsoluteUploadPath(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(input.body));
  return { key, url: pathToFileURL(absolutePath).href };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function readStoredObject(
  storageUrl: string,
  bucketOverride?: R2Bucket
): Promise<Uint8Array> {
  // R2-backed objects (private bucket; served through the auth-gated proxy)
  if (storageUrl.startsWith("r2://")) {
    const bucket = bucketOverride ?? getReceiptsBucket();
    if (!bucket) {
      throw new Error("R2 bucket binding unavailable");
    }
    const key = storageUrl.slice("r2://".length);
    const object = await bucket.get(key);
    if (!object) {
      throw new Error(`Stored receipt not found in R2: ${key}`);
    }
    return new Uint8Array(await object.arrayBuffer());
  }

  // HTTP(S) URLs — any remote URL
  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
    const response = await fetch(storageUrl);
    if (!response.ok) {
      throw new Error(`Unable to fetch stored receipt file: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  // Local file:// URLs (dev/test)
  if (storageUrl.startsWith("file://")) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");

    const uploadRoot = getUploadRoot();
    const absolutePath = fileURLToPath(storageUrl);
    const relative = path.relative(uploadRoot, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("File path is outside local upload directory");
    }
    const contents = await readFile(absolutePath);
    return new Uint8Array(contents);
  }

  throw new Error(`Unsupported storage URL scheme: ${storageUrl}`);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteStoredObject(storageUrl: string): Promise<void> {
  if (storageUrl.startsWith("r2://")) {
    const bucket = getReceiptsBucket();
    if (bucket) {
      await bucket.delete(storageUrl.slice("r2://".length));
    }
    return;
  }

  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
    // Remote URLs are not owned by this app; nothing to clean up.
    return;
  }

  if (storageUrl.startsWith("file://")) {
    const { unlink } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");

    try {
      await unlink(fileURLToPath(storageUrl));
    } catch {
      // File may already be removed; don't fail
    }
    return;
  }
}
