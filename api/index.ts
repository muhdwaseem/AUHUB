// Vercel serverless entrypoint. Every /api/* request (see vercel.json rewrites)
// is handed to the Express app, which already namespaces its routes under /api.
import app from "../server/src/app.js";

export default app;
