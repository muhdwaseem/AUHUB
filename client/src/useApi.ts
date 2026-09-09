import { useCallback, useEffect, useState } from "react";
import { api, apiError } from "./api";

export function useFetch<T>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    try {
      const r = await api.get<T>(url);
      setData(r.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
