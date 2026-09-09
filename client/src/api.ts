import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

const TOKEN_KEY = "crmgold_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data;
    // Our API sends { error: "message" }. A crashed/edge response (e.g. Vercel's
    // { error: { code, message } }) can nest it — never let a non-string escape,
    // it would be rendered as a React child and blow up the page.
    const candidates = [
      typeof body === "string" ? body : undefined,
      typeof body?.error === "string" ? body.error : body?.error?.message,
      body?.message,
      err.message,
    ];
    const msg = candidates.find((c) => typeof c === "string" && c.length > 0);
    return msg || "Request failed";
  }
  return "Something went wrong";
}
