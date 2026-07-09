import { signToken, safeEqual } from "./_lib/auth";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return Response.json({ error: "Server is missing ADMIN_PASSWORD configuration." }, { status: 500 });
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!password || !safeEqual(password, adminPassword)) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  try {
    return Response.json({ token: signToken() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Server misconfiguration." },
      { status: 500 },
    );
  }
}
