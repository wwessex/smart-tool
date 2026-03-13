import { useEffect, useState } from "react";

interface WebGPUStatus {
  supported: boolean;
  checking: boolean;
  errorMessage?: string;
}

export function useWebGPUSupport(): WebGPUStatus {
  const [status, setStatus] = useState<WebGPUStatus>({
    supported: false,
    checking: true,
  });

  useEffect(() => {
    async function checkWebGPU() {
      try {
        // Type-safe WebGPU check
        const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } };

        if (!nav.gpu) {
          setStatus({
            supported: false,
            checking: false,
            errorMessage: "WebGPU is not available in this browser",
          });
          return;
        }

        const adapter = await nav.gpu.requestAdapter();
        if (!adapter) {
          setStatus({
            supported: false,
            checking: false,
            errorMessage: "No WebGPU adapter found. Your GPU may not be supported.",
          });
          return;
        }

        setStatus({ supported: true, checking: false });
      } catch (err) {
        setStatus({
          supported: false,
          checking: false,
          errorMessage: err instanceof Error ? err.message : "WebGPU check failed",
        });
      }
    }

    checkWebGPU();
  }, []);

  return status;
}
