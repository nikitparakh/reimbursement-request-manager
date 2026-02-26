import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { env } from "@/lib/env";

export type StoredObject = {
  key: string;
  url: string;
};

const uploadRoot = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

function safeExtension(fileName: string) {
  const rawExt = path.extname(fileName).toLowerCase();
  const normalizedExt = rawExt.replace(/[^.a-z0-9]/g, "");
  if (!normalizedExt || normalizedExt === "." || normalizedExt.length > 10) {
    return ".bin";
  }
  return normalizedExt;
}

function toAbsoluteUploadPath(key: string) {
  const filePath = path.resolve(uploadRoot, key);
  const relative = path.relative(uploadRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe storage path");
  }
  return filePath;
}

export async function uploadReceiptFile(input: {
  fileName: string;
  mimeType: string;
  body: Uint8Array;
}): Promise<StoredObject> {
  const key = path.join("receipts", `${randomUUID()}${safeExtension(input.fileName)}`);
  const absolutePath = toAbsoluteUploadPath(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(input.body));
  return { key, url: pathToFileURL(absolutePath).href };
}

export async function readStoredObject(storageUrl: string): Promise<Uint8Array> {
  if (storageUrl.startsWith("file://")) {
    const absolutePath = fileURLToPath(storageUrl);
    const relative = path.relative(uploadRoot, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("File path is outside local upload directory");
    }
    const contents = await readFile(absolutePath);
    return new Uint8Array(contents);
  }

  const response = await fetch(storageUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch stored receipt file: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
