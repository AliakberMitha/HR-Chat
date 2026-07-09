import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import { verifyToken } from "./lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body as { token?: string; url?: string; meta?: unknown } | undefined;
    const { token, url, meta } = body ?? {};

    if (!verifyToken(token)) {
      res.status(401).json({ error: "Unauthorized: admin session is missing or expired." });
      return;
    }
    if (typeof url !== "string" || !meta || typeof meta !== "object") {
      res.status(400).json({ error: "Missing url or meta." });
      return;
    }

    await put("current-dataset.json", JSON.stringify({ url, meta }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("dataset-set-current failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unexpected server error." });
  }
}
