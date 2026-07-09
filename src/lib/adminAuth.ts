import { parseJsonResponse } from "./apiFetch";

const TOKEN_KEY = "hrchat:admin-token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function isAdminAuthed(): boolean {
  return Boolean(getAdminToken());
}

export async function adminLogin(password: string): Promise<void> {
  const res = await fetch("/api/admin-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseJsonResponse<{ error?: string; token?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || `Login failed (${res.status})`);
  }
  if (!data.token) {
    throw new Error("Login succeeded but no session token was returned.");
  }
  sessionStorage.setItem(TOKEN_KEY, data.token);
}

export function adminLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
}
