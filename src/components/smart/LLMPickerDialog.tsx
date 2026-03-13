import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Mode } from '@/hooks/useSmartForm';
import {
  Bot, AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';

export interface LLMPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  pendingAIDraftRef: React.MutableRefObject<boolean>;
  templateDraftNow: () => void;
  templateDraftTaskBased: () => void;
  llm: {
    isLoading: boolean;
    error: string | null;
    classifiedError: { title: string; message: string; retryable: boolean } | null;
    loadingStatus: string;
    loadingProgress: number;
    selectedModel: string | null;
    supportedModels: Array<{ id: string; name: string; size: string; description: string }>;
    loadModel: (id: string) => Promise<boolean>;
    unload: () => void;
    clearError: () => void;
  };
  storage: {
    preferredLLMModel?: string;
    updatePreferredLLMModel?: (id: string) => void;
    updateAIDraftMode?: (mode: string) => void;
  };
}

export function LLMPickerDialog({
  open,
  onOpenChange,
  mode,
  pendingAIDraftRef,
  templateDraftNow,
  templateDraftTaskBased,
  llm,
  storage,
}: LLMPickerDialogProps) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) pendingAIDraftRef.current = false;
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Load Local AI Model
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a model to enable AI-powered drafting. Models run locally in your browser for privacy.
          </p>

          {llm.isLoading ? (
            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{llm.loadingStatus}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${llm.loadingProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {llm.loadingProgress}% - First download may take a few minutes
              </p>
            </div>
          ) : llm.error ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
              {llm.classifiedError && (
                <p className="text-sm font-medium text-destructive">{llm.classifiedError.title}</p>
              )}
              <p className="text-sm text-destructive">{llm.classifiedError?.message || llm.error}</p>
              <div className="flex items-center gap-2">
                {(!llm.classifiedError || llm.classifiedError.retryable) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      llm.clearError();
                      const modelId = llm.selectedModel || storage.preferredLLMModel || llm.supportedModels[0]?.id;
                      if (modelId) {
                        llm.unload();
                        await llm.loadModel(modelId);
                      }
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Try Again
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => llm.clearError()}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {llm.supportedModels.map((model) => (
                <button
                  key={model.id}
                  onClick={async () => {
                    const success = await llm.loadModel(model.id);
                    if (success) {
                      if (storage.updatePreferredLLMModel) {
                        storage.updatePreferredLLMModel(model.id);
                      }
                      if (storage.updateAIDraftMode) {
                        storage.updateAIDraftMode('ai');
                      }
                      onOpenChange(false);

                      if (!pendingAIDraftRef.current) {
                        toast({ title: 'Model loaded', description: `${model.name} is ready for AI Draft.` });
                      }
                    }
                  }}
                  className="w-full p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 ease-spring text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.size}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                pendingAIDraftRef.current = false;
                onOpenChange(false);
                if (mode === 'now') {
                  templateDraftNow();
                } else {
                  templateDraftTaskBased();
                }
              }}
            >
              Use template instead
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                pendingAIDraftRef.current = false;
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
