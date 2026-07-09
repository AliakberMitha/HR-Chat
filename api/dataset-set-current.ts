import { put } from "@vercel/blob";
import { verifyToken } from "./_lib/auth";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let token: string | undefined;
  let url: string | undefined;
  let meta: unknown;
  try {
    const body = await request.json();
    token = body?.token;
    url = body?.url;
    meta = body?.meta;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!verifyToken(token)) {
    return Response.json({ error: "Unauthorized: admin session is missing or expired." }, { status: 401 });
  }
  if (typeof url !== "string" || !meta || typeof meta !== "object") {
    return Response.json({ error: "Missing url or meta." }, { status: 400 });
  }

  await put("current-dataset.json", JSON.stringify({ url, meta }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return Response.json({ ok: true });
}
