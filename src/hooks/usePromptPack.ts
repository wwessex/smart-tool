import { useEffect, useState } from "react";
import { loadPromptPack, type PromptPack } from "@/lib/prompt-pack";

export function usePromptPack() {
  const [pack, setPack] = useState<PromptPack | null>(null);
  const [source, setSource] = useState<"default" | "cache" | "remote" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await loadPromptPack();
        if (cancelled) return;
        setPack(res.pack);
        setSource(res.source);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { pack, source, error };
}
