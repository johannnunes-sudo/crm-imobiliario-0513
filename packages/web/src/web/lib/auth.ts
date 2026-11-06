import { createAuthClient } from "better-auth/react";

const TOKEN_KEY = "pf_crm_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? "";
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Bearer token em localStorage: funciona dentro de iframes (preview) e no desktop.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_WEBSITE_URL ?? window.location.origin,
  basePath: "/api/auth",
  fetchOptions: {
    auth: { type: "Bearer", token: () => getToken() },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) setToken(token);
    },
  },
});

export async function signOut() {
  await authClient.signOut();
  clearToken();
  window.location.href = "/login";
}
