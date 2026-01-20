import { useEffect, useState } from "react";
import { AlertCircle, Chrome, Globe } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface WebGPUCheckProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

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

export function WebGPUCheck({ children, fallback }: WebGPUCheckProps) {
  const { supported, checking, errorMessage } = useWebGPUSupport();

  if (checking) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Checking browser compatibility...</span>
        </div>
      </div>
    );
  }

  if (!supported) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return <WebGPUNotSupported errorMessage={errorMessage} />;
  }

  return <>{children}</>;
}

interface WebGPUNotSupportedProps {
  errorMessage?: string;
}

export function WebGPUNotSupported({ errorMessage }: WebGPUNotSupportedProps) {
  return (
    <div className="p-6 space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>WebGPU Not Available</AlertTitle>
        <AlertDescription>
          {errorMessage || "Your browser doesn't support WebGPU, which is required for local AI."}
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          WebGPU enables running AI models directly in your browser. To use this feature, please try one of these browsers:
        </p>

        <div className="grid gap-2">
          <BrowserOption
            icon={<Chrome className="h-4 w-4" />}
            name="Google Chrome"
            version="113+"
            url="https://www.google.com/chrome/"
          />
          <BrowserOption
            icon={<Globe className="h-4 w-4" />}
            name="Microsoft Edge"
            version="113+"
            url="https://www.microsoft.com/edge"
          />
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          <strong>Note:</strong> WebGPU is not yet supported on iOS Safari or Firefox. 
          On macOS, Chrome/Edge work well. On Windows, ensure you have updated GPU drivers.
        </p>
      </div>
    </div>
  );
}

interface BrowserOptionProps {
  icon: React.ReactNode;
  name: string;
  version: string;
  url: string;
}

function BrowserOption({ icon, name, version, url }: BrowserOptionProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
    >
      {icon}
      <div className="flex-1">
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">Version {version} or later</div>
      </div>
      <Button variant="outline" size="sm">
        Download
      </Button>
    </a>
  );
}
