import { useCallback, useEffect, useState } from "react";
import { api, apiError } from "./api";

// Module-level cache of the last successful payload per URL. On a revisit the
// page paints instantly from this while a fresh copy loads in the background,
// instead of flashing a full-screen spinner on every navigation.
const cache = new Map<string, unknown>();

export function useFetch<T>(url: string | null, deps: any[] = []) {
  const seed = url ? (cache.get(url) as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(seed ?? null);
  const [loading, setLoading] = useState(seed === undefined);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!url) return;
    const hadCache = cache.has(url);
    if (hadCache) setValidating(true);
    else setLoading(true);
    setError("");
    try {
      const r = await api.get<T>(url);
      cache.set(url, r.data);
      setData(r.data);
    } catch (e) {
      // Only surface the error when there's nothing to show. A failed
      // background refresh keeps the stale data on screen rather than
      // replacing a working page with an error box.
      if (!cache.has(url)) setError(apiError(e));
    } finally {
      setLoading(false);
      setValidating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    // On url/deps change, immediately show any cached payload for the new url
    // (or clear, if it's a genuinely new request) before revalidating.
    if (url && cache.has(url)) {
      setData(cache.get(url) as T);
      setLoading(false);
    } else if (url) {
      setData(null);
      setLoading(true);
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { data, loading, validating, error, reload, setData };
}
