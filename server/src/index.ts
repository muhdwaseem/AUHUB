import app from "./app.js";

// Local / VPS entrypoint. On Vercel the app is imported by ../../api/index.ts
// and run as a serverless function, so this file is never executed there.
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`CRMgold API listening on http://localhost:${PORT}`);
});
