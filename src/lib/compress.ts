export async function gzipJson(data: unknown): Promise<Blob> {
  const json = JSON.stringify(data);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

export async function gunzipJson<T = unknown>(blob: Blob): Promise<T> {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text) as T;
}
