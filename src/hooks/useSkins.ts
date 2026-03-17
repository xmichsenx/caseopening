import { useState, useEffect } from "react";
import type { Skin } from "../types";
import { fetchSkins } from "../api";

export function useSkins() {
  const [skins, setSkins] = useState<Skin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchSkins()
      .then((skinsData) => {
        if (!cancelled) {
          setSkins(skinsData);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { skins, loading, error };
}
