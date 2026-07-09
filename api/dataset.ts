import { list } from "@vercel/blob";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { blobs } = await list({ prefix: "current-dataset.json", limit: 1 });
    const pointer = blobs.find((b) => b.pathname === "current-dataset.json");
    if (!pointer) {
      return Response.json({ error: "No dataset has been uploaded yet." }, { status: 404 });
    }

    const res = await fetch(pointer.url, { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ error: "Failed to read the dataset pointer." }, { status: 502 });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to look up the dataset." },
      { status: 500 },
    );
  }
}
