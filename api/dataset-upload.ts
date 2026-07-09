import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyToken } from "./_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body as HandleUploadBody;

  try {
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
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed." });
  }
}
