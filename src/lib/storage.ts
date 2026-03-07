import { env } from "@/lib/env";

export type StoredObject = {
  key: string;
  url: string;
};

const isVercelBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// ---------------------------------------------------------------------------
// Local filesystem helpers (only loaded when NOT using Vercel Blob)
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
  if (isVercelBlob) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`receipts/${input.fileName}`, Buffer.from(input.body), {
      access: "public",
      contentType: input.mimeType,
      addRandomSuffix: true,
    });
    return { key: blob.pathname, url: blob.url };
  }

  const path = await import("node:path");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { randomUUID } = await import("node:crypto");
  const { pathToFileURL } = await import("node:url");

  const key = path.join("receipts", `${randomUUID()}${safeExtension(input.fileName)}`);
  const absolutePath = toAbsoluteUploadPath(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(input.body));
  return { key, url: pathToFileURL(absolutePath).href };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function readStoredObject(storageUrl: string): Promise<Uint8Array> {
  // HTTP(S) URLs — works for both Vercel Blob and any remote URL
  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
    const response = await fetch(storageUrl);
    if (!response.ok) {
      throw new Error(`Unable to fetch stored receipt file: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  // Local file:// URLs
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
  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
    if (isVercelBlob) {
      const { del } = await import("@vercel/blob");
      await del(storageUrl);
    }
    // Non-blob HTTP URLs: nothing to clean up
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
