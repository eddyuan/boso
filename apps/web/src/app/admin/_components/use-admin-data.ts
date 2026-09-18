import { useCallback, useEffect, useState } from "react";

/**
 * GET a JSON admin endpoint. Refetches when `url` changes; a slower, older
 * response never overwrites a newer one. While a refetch is in flight the last
 * data stays up, so paging and searching don't flash an empty page.
 */
export function useAdminData<T>(url: string) {
  const [version, setVersion] = useState(0);
  const key = `${url}#${version}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))))
      .then(
        (data) => live && setState({ key, data, error: false }),
        () => live && setState((prev) => ({ key, data: prev?.data ?? null, error: true })),
      );
    return () => {
      live = false;
    };
  }, [url, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data: state?.data ?? null,
    loading: state?.key !== key,
    error: state?.key === key && state.error,
    reload,
  };
}
