import type { VercelRequest, VercelResponse } from "@vercel/node";
import { list } from "@vercel/blob";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { blobs } = await list({ prefix: "current-dataset.json", limit: 1 });
    const pointer = blobs.find((b) => b.pathname === "current-dataset.json");
    if (!pointer) {
      res.status(404).json({ error: "No dataset has been uploaded yet." });
      return;
    }

    const blobRes = await fetch(pointer.url, { cache: "no-store" });
    if (!blobRes.ok) {
      res.status(502).json({ error: "Failed to read the dataset pointer." });
      return;
    }
    const data = await blobRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("dataset lookup failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to look up the dataset." });
  }
}
