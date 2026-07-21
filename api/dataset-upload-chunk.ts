import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import { extractBearerToken, verifyAdminToken } from "../server-shared/adminToken.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const token = extractBearerToken(req.headers.authorization);
    if (!verifyAdminToken(token)) {
      res.status(401).json({ error: "Unauthorized: admin session is missing or expired." });
      return;
    }

    const index = Number(req.query.index);
    if (!Number.isInteger(index) || index < 0) {
      res.status(400).json({ error: "Missing or invalid chunk index." });
      return;
    }

    // Vercel auto-parses an `application/octet-stream` body into req.body as a Buffer.
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: "Empty or invalid chunk body." });
      return;
    }

    const blob = await put(`dataset-chunks/chunk-${index}.json.gz`, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/gzip",
    });

    res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("dataset-upload-chunk failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unexpected server error." });
  }
}
