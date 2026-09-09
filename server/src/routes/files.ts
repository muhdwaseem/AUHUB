import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../lib/auth.js";

export const filesRouter = Router();

// Any authenticated user (admin or investor) can view a payment slip / invoice.
// The bytes live in Vercel Blob; we gate access here, then redirect to the
// unguessable public URL (a serverless function can't stream a 15 MB body back).
filesRouter.get("/:id", authRequired, async (req, res) => {
  const att = await prisma.expenseAttachment.findUnique({ where: { id: req.params.id } });
  if (!att) return res.status(404).json({ error: "File not found" });
  res.redirect(302, att.blobUrl);
});
