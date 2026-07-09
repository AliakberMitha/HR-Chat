import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signToken, safeEqual } from "./_lib/auth";

export default function handler(req: VercelRequest, res: VercelResponse) {
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

  try {
    res.status(200).json({ token: signToken() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server misconfiguration." });
  }
}
