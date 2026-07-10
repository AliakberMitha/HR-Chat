import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured on the server.");
  }
  return secret;
}

function signToken(): string {
  const expires = Date.now() + TTL_MS;
  const payload = String(expires);
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ah = createHmac("sha256", "cmp").update(a).digest();
  const bh = createHmac("sha256", "cmp").update(b).digest();
  return ah.length === bh.length && timingSafeEqual(ah, bh);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      res.status(500).json({ error: "Server is missing ADMIN_PASSWORD configuration." });
      return;
    }

    const body = req.body as { password?: unknown } | undefined;
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password || !safeEqual(password, adminPassword)) {
      res.status(401).json({ error: "Incorrect password." });
      return;
    }

    res.status(200).json({ token: signToken() });
  } catch (err) {
    console.error("admin-login failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unexpected server error." });
  }
}
