import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured on the server.");
  }
  return secret;
}

function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const secret = getSecret();
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [payload, sig] = decoded.split(".");
    if (!payload || !sig) return false;

    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return false;

    const expires = Number(payload);
    return Number.isFinite(expires) && Date.now() < expires;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!verifyToken(token)) {
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
