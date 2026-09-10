import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";

export const filesRouter = Router();

// Expense attachments (payment slips / invoices) are admin-only — investors never
// see the expense ledger, so they have no reason to fetch its files. The bytes
// live in Vercel Blob; we gate access here, then redirect to the unguessable
// public URL (a serverless function can't stream a 15 MB body back). If the
// portal ever surfaces "charged to you" receipts, scope this to that investor's
// own attachments instead of opening it to every authenticated user.
filesRouter.get("/:id", authRequired, adminRequired, async (req, res) => {
  const att = await prisma.expenseAttachment.findUnique({ where: { id: req.params.id } });
  if (!att) return res.status(404).json({ error: "File not found" });
  res.redirect(302, att.blobUrl);
});
