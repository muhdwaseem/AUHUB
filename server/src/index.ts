import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { MulterError } from "multer";

import { authRouter } from "./routes/auth.js";
import { investorsRouter } from "./routes/investors.js";
import { expenseCategoriesRouter } from "./routes/expenseCategories.js";
import { expensesRouter } from "./routes/expenses.js";
import { goldRouter } from "./routes/gold.js";
import { reportsRouter } from "./routes/reports.js";
import { portalRouter } from "./routes/portal.js";
import { filesRouter } from "./routes/files.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "crmgold-api" }));

app.use("/api/auth", authRouter);
app.use("/api/investors", investorsRouter);
app.use("/api/expense-categories", expenseCategoriesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/gold", goldRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/portal", portalRouter);
app.use("/api/files", filesRouter);

// Error handler (multer + thrown errors)
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err instanceof Error) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
    console.error("Unknown error", err);
    res.status(500).json({ error: "Something went wrong" });
  }
);

app.listen(PORT, () => {
  console.log(`CRMgold API listening on http://localhost:${PORT}`);
});
