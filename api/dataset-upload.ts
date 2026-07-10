import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
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

    const body = req.body as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!verifyToken(clientPayload)) {
          throw new Error("Unauthorized: admin session is missing or expired. Please log in again.");
        }
        return {
          allowedContentTypes: ["application/gzip", "application/octet-stream"],
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
    });
    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("dataset-upload failed:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed." });
  }
}
