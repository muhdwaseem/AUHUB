import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../lib/auth.js";
import { UPLOAD_DIR } from "../lib/upload.js";

export const filesRouter = Router();

// Any authenticated user (admin or investor) can view a payment slip / invoice.
filesRouter.get("/:id", authRequired, async (req, res) => {
  const att = await prisma.expenseAttachment.findUnique({ where: { id: req.params.id } });
  if (!att) return res.status(404).json({ error: "File not found" });
  const filePath = path.join(UPLOAD_DIR, att.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

  res.setHeader("Content-Type", att.mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${att.originalName.replace(/"/g, "")}"`
  );
  fs.createReadStream(filePath).pipe(res);
});
