import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyToken } from "./_lib/auth";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
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
    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
