export async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "The /api functions aren't available. If you're developing locally, use `npm run dev:full` (vercel dev) instead of `npm run dev`.",
    );
  }
  return res.json() as Promise<T>;
}
