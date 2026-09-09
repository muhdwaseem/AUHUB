import multer from "multer";
import { put, del } from "@vercel/blob";
import { customAlphabet } from "nanoid";

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/**
 * Files are buffered in memory (serverless has no writable disk) and pushed to
 * Vercel Blob. The public URL carries a random suffix so it can't be guessed;
 * `/api/files/:id` still gates access with an auth check before redirecting.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only images (PNG, JPG, WEBP, GIF) and PDF files are allowed"));
  },
});

export interface StoredAttachment {
  blobUrl: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export async function putAttachment(file: Express.Multer.File): Promise<StoredAttachment> {
  const ext = (file.originalname.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();
  const { url } = await put(`expenses/${nano()}${ext}`, file.buffer, {
    access: "public",
    contentType: file.mimetype,
    addRandomSuffix: true,
  });
  return {
    blobUrl: url,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

export async function deleteAttachment(blobUrl: string): Promise<void> {
  try {
    await del(blobUrl);
  } catch {
    // already gone / token missing — nothing to do
  }
}
