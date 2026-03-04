import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "veltest-storage-"));
  process.env.LOCAL_STORAGE_DIR = tmpDir;
});

afterAll(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

describe("storage", () => {
  it("uploadReceiptFile writes file and returns key + url", async () => {
    // Re-import to pick up new env
    const { uploadReceiptFile } = await import("@/lib/storage");

    const result = await uploadReceiptFile({
      fileName: "test-receipt.pdf",
      mimeType: "application/pdf",
      body: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });

    expect(result.key).toContain("receipts/");
    expect(result.key).toMatch(/\.pdf$/);
    expect(result.url).toMatch(/^file:\/\//);
  });

  it("readStoredObject reads back a file:// URL", async () => {
    const { uploadReceiptFile, readStoredObject } = await import("@/lib/storage");

    const content = new Uint8Array([1, 2, 3, 4, 5]);
    const { url } = await uploadReceiptFile({
      fileName: "roundtrip.bin",
      mimeType: "application/octet-stream",
      body: content,
    });

    const read = await readStoredObject(url);
    expect(read).toEqual(content);
  });

  it("readStoredObject rejects paths outside upload root", async () => {
    const { readStoredObject } = await import("@/lib/storage");

    await expect(
      readStoredObject("file:///etc/passwd")
    ).rejects.toThrow(/outside local upload directory/);
  });
});
